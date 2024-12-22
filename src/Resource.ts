import type { HonoRequest, Handler } from 'jsr:@hono/hono@4.6.14';
import { Hono } from 'jsr:@hono/hono@4.6.14';
import type { z } from 'npm:zod@3.24.1';
import { ACCEPT_METADATA_KEY, BODY_METADATA_KEY, PATH_METADATA_KEY, QUERY_METADATA_KEY, ROUTE_METADATA_KEY } from './common/constants.ts';
import type { ParameterMetadata } from './common/types.ts';
import { BadRequestError, MethodNotAllowedError, UnsupportedMediaTypeError } from './common/errors.ts';
import { ContentTypes, Headers, HttpStatusCodes, RequestMethod } from './common/enums.ts';
import { createReadableFromIterable, literalToLowerCase } from "./common/utils.ts";

type ResourceMethodReturn =
  Promise<Response | void>
  | Response | void;
export function isBodyInit(value: unknown): value is BodyInit {
  return typeof value === 'string'
    || value instanceof Blob
    || value instanceof ArrayBuffer
    || value instanceof FormData || value instanceof URLSearchParams
    || value instanceof ReadableStream;
}
export function Result<T extends BodyInit | (() => Iterable<unknown, unknown, unknown>) | number | boolean | object | undefined = never>(
  status: HttpStatusCodes,
  content?: T,
  contentType?: ContentTypes
): Response {
  if ((isBodyInit(content) && contentType !== ContentTypes.Json) || typeof content === "function") {
    const headers = new globalThis.Headers();
    let body;
    if (contentType) headers.set(Headers.ContentType, contentType);
    if (typeof content === "function") {
      body = createReadableFromIterable(content());
    } else {
      body = content;
    }
    return new Response(body, { status, headers });
  } else {
    return Response.json(content);
  }
}
export type ResourceMethods = keyof Omit<IResource, 'connection' | 'path' | 'request' | 'response'>;
export interface IResource {
  readonly path: string;
  readonly request: Request;
  readonly response: Response;
  // Methods
  CONNECT?(...args: unknown[]): ResourceMethodReturn;
  DELETE?(...args: unknown[]): ResourceMethodReturn;
  GET?(...args: unknown[]): ResourceMethodReturn;
  HEAD?(...args: unknown[]): ResourceMethodReturn;
  OPTIONS?(...args: unknown[]): ResourceMethodReturn;
  PATCH?(...args: unknown[]): ResourceMethodReturn;
  POST?(...args: unknown[]): ResourceMethodReturn;
  PUT?(...args: unknown[]): ResourceMethodReturn;
  TRACE?(...args: unknown[]): ResourceMethodReturn;
}
type ResourceConstructorArgs = unknown[];
export type NonAbstractResourceLikeConstructor = (new (...args: ResourceConstructorArgs) => Resource) & { path: string };
export type AbstractResourceLikeConstructor = (abstract new (...args: ResourceConstructorArgs) => Resource) & { path: string };
export type ResourceLikeConstructor = NonAbstractResourceLikeConstructor | AbstractResourceLikeConstructor;
export abstract class Resource implements IResource {
  declare public request: Request;
  declare public response: Response;
  /**
   * The root app instance.
   */
  public static readonly app: Hono = Resource.appBuilder();
  private readonly app = Resource.appBuilder(this);

  constructor() {
    const { app, handleRequest } = this;
    const methods = this.methods.filter(method => RequestMethod.Head !== method);
    const parentInstance = Object.getPrototypeOf(Object.getPrototypeOf(this));
    if (methods.some(method => Object.hasOwn(parentInstance, method)))
      throw new TypeError(`${this.constructor.name} cannot extend ${parentInstance.constructor.name}. Resources must extend abstract/virtual resources.`);
    // a Resource without methods is no resource at all
    if (!methods.length) return;
    for (const method of methods) {
      const paramMetadata: ParameterMetadata = Reflect.getMetadata(PATH_METADATA_KEY, this, method) ?? {};
      const params = Object.keys(paramMetadata).map(param => {
        const optional = paramMetadata[param].type.isOptional();
        return `:${param}${optional ? '?' : ''}`;
      }).toReversed().join('/');
      if (!params.length) continue;
      app[literalToLowerCase(method)](params, handleRequest);
    }
    app.all('', handleRequest);
    Resource.app.route('', app);
  }

  /**
   * Builds a new Hono instance given a 'leaf' Resource by travelling up the resource tree to build a fully qualified base path.
   * @param instance Leaf instance
   * @returns new Hono app with base path fully qualified base path
   */
  private static appBuilder(instance?: Resource) {
    let parent = instance?.parent;
    const basePaths = new Array<string>();
    let baseApp = new Hono({ strict: true });
    // collect base paths
    while (parent) {
      basePaths.push(parent.path);
      parent = parent.parent;
    }
    // attach base paths
    for (const basePath of basePaths.toReversed()) {
      baseApp = baseApp.basePath(basePath);
    }
    return baseApp.basePath(instance?.path ?? '');
  }

  protected static get parent(): typeof Resource | null {
    if (this === Resource) return null;
    return Object.getPrototypeOf(this);
  }

  protected get parent(): typeof Resource | null {
    if (this.constructor === Resource) return null;
    return Object.getPrototypeOf(this.constructor);
  }

  public get methods(): RequestMethod[] {
    return Object.values(RequestMethod).filter((method => method in this));
  }

  public static get path(): string {
    return Reflect.getMetadata(`${this.name}${ROUTE_METADATA_KEY}`, this) ?? this.name.toLowerCase().replace('resource', '');
  }

  public get path(): string {
    return (this.constructor as typeof Resource).path;
  }

  public get HEAD(): ((...args: unknown[]) => ResourceMethodReturn) | undefined {
    return (this as IResource)['GET'];
  }

  private readonly handleRequest: Handler = async (context) => {
    context.res.headers.set(Headers.TraceId, crypto.randomUUID()); // set trace header
    const method = context.req.method.toUpperCase() as ResourceMethods;
    const resource = { ...this }; // clone resource
    Object.setPrototypeOf(resource, this); // set prototype to this
    Object.defineProperty(resource, 'request', { value: context.req.raw, writable: false });
    Object.defineProperty(resource, 'response', { value: context.res, writable: false });
    const methodHandler = (this as IResource)[method]?.bind(resource);
    if (methodHandler) {
      const args: unknown[] = [];
      const issues: z.ZodIssue[] = [];
      this.parsePathArgs(method, context.req, args, issues);
      this.parseQueryArgs(method, context.req, args, issues);
      if (method !== RequestMethod.Get && method !== RequestMethod.Head)
        await this.parseBodyArgs(method, context.req, args, issues);

      if (issues.length)
        throw new BadRequestError('There were issues in your request.', { issues });
      const response = await methodHandler(...args, context.req.raw.signal);
      // if the response has already been sent, don't send it again (this is to prevent errors from being sent twice
      if (response) {
        const contentType = response.headers.get(Headers.ContentType);
        if (contentType) context.res.headers.set(Headers.ContentType, contentType);
        Object.defineProperty(response, 'headers', { value: context.res.headers });
        return response;
      } else {
        context.status(HttpStatusCodes.NoContent);
        return context.res;
      }
    } else if (method !== RequestMethod.Options) {
      throw new MethodNotAllowedError();
    } else {
      context.status(HttpStatusCodes.NoContent);
      context.res.headers.set(Headers.Allow, this.methods.join(', '));
      return context.res;
    }
  };

  private async parseBodyArgs(
    method: ResourceMethods,
    request: HonoRequest,
    args: unknown[],
    issues: z.ZodIssue[]
  ) {
    const paramMetadata: ParameterMetadata<z.ZodType> = Reflect.getMetadata(BODY_METADATA_KEY, this, method) ?? {};
    const acceptedContentTypes: ContentTypes[] = Reflect.getMetadata(ACCEPT_METADATA_KEY, this, method) ?? [ContentTypes.Json];
    const contentType = request.raw.headers.get(Headers.ContentType) ?? ContentTypes.Json;
    let body;
    switch(acceptedContentTypes.find(contentType.includes.bind(contentType))) {
      case ContentTypes.FormUrlEncoded:
      case ContentTypes.MultipartFormData:
        body = await request.parseBody();
      break;
      case ContentTypes.Json:
        body = await request.json();
      break;
      default:
        throw new UnsupportedMediaTypeError(`Content type '${contentType}' is unsupported`);
    }

    for (const metadata of Object.values(paramMetadata)) {
      const parseResult = metadata.type.safeParse(body);
      if (parseResult.error) {
        issues.push(...parseResult.error.issues);
      } else {
        args[metadata.parameterIndex] = parseResult.data;
      }
    }
    return args;
  }

  private parsePathArgs(method: ResourceMethods, request: HonoRequest, args: unknown[], issues: z.ZodIssue[]) {
    const paramMetadata: ParameterMetadata = Reflect.getMetadata(PATH_METADATA_KEY, this, method) ?? {};
    const params = new Array<string>();
    for (const [param, metadata] of Object.entries(paramMetadata).toReversed()) {
      params.push(`:${param}`);
      // value of path parameter
      const value = request.param(param);
      const parseResult = metadata.type.safeParse(value);
      if (parseResult.error) {
        issues.push(...parseResult.error.issues.map(issue => {
          // get path up until bad path part
          const path = `${this.path}/${params.join('/')}`;
          issue.path.push(path);
          return issue;
        }));
      } else {
        args[metadata.parameterIndex] = parseResult.data;
      }
    }
    return args;
  }

  private parseQueryArgs(method: ResourceMethods, request: HonoRequest, args: unknown[], issues: z.ZodIssue[]) {
    const paramMetadata: ParameterMetadata = Reflect.getMetadata(QUERY_METADATA_KEY, this, method) ?? {};
    for (const [param, metadata] of Object.entries(paramMetadata)) {
      // value of query parameter
      const value = request.query(param);
      const parseResult = metadata.type.safeParse(value);
      if (parseResult.error) {
        issues.push(...parseResult.error.issues.map(issue => {
          issue.path.push(`?${param}=`);
          return issue;
        }));
      } else {
        args[metadata.parameterIndex] = parseResult.data;
      }
    }
    return args;
  }
}