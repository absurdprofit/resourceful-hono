import type { HonoRequest, Handler, Context } from 'jsr:@hono/hono@4.6.14';
import { mergePath } from 'jsr:@hono/hono@4.6.14/utils/url';
import { Hono } from 'jsr:@hono/hono@4.6.14';
import type { z } from 'npm:zod@3.24.1';
import { ACCEPT_METADATA_KEY, BODY_METADATA_KEY, QUERY_METADATA_KEY, ROUTE_METADATA_KEY } from './common/constants.ts';
import { type ParameterMetadata, type ResourceMethodReturn, isBodyInit } from './common/types.ts';
import { BadRequestError, MethodNotAllowedError, UnsupportedMediaTypeError } from './common/errors.ts';
import { ContentTypes, Headers, HttpStatusCodes, RequestMethod } from './common/enums.ts';
import { createReadableFromIterable, literalToLowerCase } from "./common/utils.ts";
import { Application } from "./Application.ts";

export function Redirect<S extends HttpStatusCodes | number>(status: S, url: URL | string) {
  if (status < 300 || status > 399)
    throw new RangeError(`Invalid redirect status code: ${status}`);
  return new Response(
    undefined,
    {
      status,
      headers: {
        [Headers.Location]: url.toString(),
      },
    },
  );
}

export function Result<
  S extends HttpStatusCodes | number,
  C extends BodyInit | (() => Iterator<unknown, unknown, unknown> | AsyncIterator<unknown, unknown, unknown>) | number | boolean | object | null,
  T extends ContentTypes | string
>(
  status: S,
  content?: C,
  contentType?: T
): Response {
  if ((isBodyInit(content) && contentType !== ContentTypes.Json) || content === undefined || typeof content === "function") {
    const headers = new globalThis.Headers();
    let body;
    if (contentType) headers.set(Headers.ContentType, contentType);
    if (typeof content === "function") {
      body = createReadableFromIterable(content());
      if (contentType?.startsWith('text/')) {
        body = body.pipeThrough(new TextEncoderStream());
      }
    } else {
      body = content;
    }
    return new Response(body, { status, headers });
  } else {
    return Response.json(content);
  }
}
export interface IResource {
  readonly route: string;
  readonly context: Context;
  readonly request: Request;
  readonly response: Response;
  // Methods
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
export type NonAbstractResourceLikeConstructor = (new (...args: ResourceConstructorArgs) => Resource) & { route: string };
export type AbstractResourceLikeConstructor = (abstract new (...args: ResourceConstructorArgs) => Resource) & { route: string };
export type ResourceLikeConstructor = NonAbstractResourceLikeConstructor | AbstractResourceLikeConstructor;
export abstract class Resource implements IResource {
  declare public readonly context: Context;
  /**
   * The root hono instance.
   */
  public static readonly hono: Hono = Resource.honoBuilder();
  private readonly hono = Resource.honoBuilder(this);
  readonly methods = Object.values(RequestMethod).filter((method => method in this));
  readonly #routeMetadata = this.collectParameterMetadata<ParameterMetadata>(ROUTE_METADATA_KEY);
  readonly #queryMetadata = this.collectParameterMetadata<ParameterMetadata>(QUERY_METADATA_KEY);
  readonly #bodyMetadata = this.collectParameterMetadata<ParameterMetadata>(BODY_METADATA_KEY);
  readonly #acceptMetadata = this.collectParameterMetadata<ContentTypes[]>(ACCEPT_METADATA_KEY);
  readonly HEAD = (this as IResource)['GET'];

  constructor() {
    const { hono, handleRequest } = this;
    const methods = this.methods.filter(method => RequestMethod.Head !== method);
    const parentInstance = Object.getPrototypeOf(Object.getPrototypeOf(this));
    if (methods.some(method => Object.hasOwn(parentInstance, method)))
      throw new TypeError(`${this.constructor.name} cannot extend ${parentInstance.constructor.name}. Resources must extend abstract/virtual resources.`);
    // a Resource without methods is no resource at all
    if (!methods.length) return;
    for (const method of methods) {
      const paramMetadata: ParameterMetadata = Reflect.getMetadata(ROUTE_METADATA_KEY, this, method) ?? {};
      const route = Object.keys(paramMetadata).map(param => {
        const optional = paramMetadata[param].type.isOptional();
        return `:${param}${optional ? '?' : ''}`;
      }).toReversed().join('/');
      hono[literalToLowerCase(method)](route, handleRequest);
    }
    hono.options('*', this.#OPTIONS);
    hono.all('*', this.#methodNotAllowed);
    Resource.hono.route('', hono);
  }

  #methodNotAllowed(): Response {
    throw new MethodNotAllowedError();
  }

  /**
   * Builds a new Hono instance given a 'leaf' Resource by travelling up the resource tree to build a fully qualified base path.
   * @param instance Leaf instance
   * @returns new Hono app with base path fully qualified base path
   */
  private static honoBuilder(instance?: Resource) {
    let parent = instance?.parent;
    const basePaths = new Array<string>();
    let baseApp = new Hono({ strict: true });
    // collect base routes
    while (parent) {
      basePaths.push(parent.route);
      parent = parent.parent;
    }
    // attach base paths
    for (const basePath of basePaths.toReversed()) {
      baseApp = baseApp.basePath(basePath);
    }
    return baseApp.basePath(instance?.route ?? '');
  }

  private collectParameterMetadata<T>(key: symbol) {
    return this.methods.reduce((metadata, method) => {
      return metadata.set(method, Reflect.getMetadata(key, this, method) ?? {});
    }, new Map<RequestMethod, T>());
  }

  protected static get parent(): typeof Resource | null {
    if (this === Resource) return null;
    return Object.getPrototypeOf(this);
  }

  protected get parent(): typeof Resource | null {
    if (this.constructor === Resource) return null;
    return Object.getPrototypeOf(this.constructor);
  }

  public static get route(): string {
    return Object.getOwnPropertyDescriptor(this, ROUTE_METADATA_KEY)?.value ?? this.name.toLowerCase().replace('resource', '');
  }

  public static get pathname(): string {
    return mergePath(this.parent?.pathname ?? '', this.route);
  }

  public get route(): string {
    return (this.constructor as typeof Resource).route;
  }

  public get request() {
    return this.context.req.raw;
  }

  public get response() {
    return this.context.res;
  }

  public get signal() {
    return this.context.req.raw.signal;
  }

  readonly #OPTIONS: Handler = (context) => {
    context.res.headers.set(Headers.Allow, this.methods.join(', '));
    return Result(HttpStatusCodes.NoContent);
  }

  public clone(context: Context) {
    const clone = { ...this }; // clone resource
    Object.setPrototypeOf(clone, this); // set prototype to this
    Object.defineProperty(clone, 'context', { value: context, writable: false });
    return clone;
  }

  private readonly handleRequest: Handler = async (context) => {
    context.res.headers.set(Headers.TraceId, crypto.randomUUID()); // set trace header
    const method = context.req.method.toUpperCase() as RequestMethod;
    const methodHandler = (this as IResource)[method]!.bind(this.clone(context));
    const args: unknown[] = [];
    const issues: z.ZodIssue[] = [];
    this.parseRouteArgs(method, context.req, args, issues);
    this.parseQueryArgs(method, context.req, args, issues);
    if (method !== RequestMethod.Get && method !== RequestMethod.Head)
      await this.parseBodyArgs(method, context.req, args, issues);

    if (issues.length)
      throw new BadRequestError('There were issues in your request.', { issues });

    if (Application.instance.state === 'idle')
      await Application.instance.ready;
    const response = await methodHandler(...args);
    return response ?? Result(HttpStatusCodes.NoContent);
  };

  private async parseBodyArgs(
    method: RequestMethod,
    request: HonoRequest,
    args: unknown[],
    issues: z.ZodIssue[]
  ) {
    const paramMetadata: ParameterMetadata<z.ZodType> = this.#bodyMetadata.get(method) ?? {};
    const acceptedContentTypes: ContentTypes[] = this.#acceptMetadata.get(method) ?? [];
    const contentType = request.raw.headers.get(Headers.ContentType) ?? '';
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

  private parseRouteArgs(method: RequestMethod, request: HonoRequest, args: unknown[], issues: z.ZodIssue[]) {
    const paramMetadata: ParameterMetadata = this.#routeMetadata.get(method) ?? {};
    const params = new Array<string>();
    for (const [param, metadata] of Object.entries(paramMetadata).toReversed()) {
      params.push(`:${param}`);
      // value of path parameter
      const value = request.param(param);
      const parseResult = metadata.type.safeParse(value);
      if (parseResult.error) {
        issues.push(...parseResult.error.issues.map(issue => {
          // get route up until bad path part
          const path = `${this.route}/${params.join('/')}`;
          issue.path.push(path);
          return issue;
        }));
      } else {
        args[metadata.parameterIndex] = parseResult.data;
      }
    }
    return args;
  }

  private parseQueryArgs(method: RequestMethod, request: HonoRequest, args: unknown[], issues: z.ZodIssue[]) {
    const paramMetadata: ParameterMetadata = this.#queryMetadata.get(method) ?? {};
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