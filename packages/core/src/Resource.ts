import type { HonoRequest, Handler, Context } from 'jsr:@hono/hono@4.6.14';
import { mergePath } from 'jsr:@hono/hono@4.6.14/utils/url';
import { Hono } from 'jsr:@hono/hono@4.6.14';
import { z } from 'npm:zod@3.24.1';
import { ACCEPT_METADATA_KEY, PARAMETER_METADATA_KEY, ROUTE_METADATA_KEY } from './common/constants.ts';
import { type ParameterMetadata, type ResourceMethodReturn, isBodyInit } from './common/types.ts';
import { BadRequestError, MethodNotAllowedError, UnsupportedMediaTypeError } from './common/errors.ts';
import { ContentTypes, Headers, HttpStatusCodes, RequestMethod } from './common/enums.ts';
import { createReadableFromIterable, literalToLowerCase } from "./common/utils.ts";
import { Application } from "./Application.ts";
import { ResourceClient, type IResourceClient } from "./ResourceClient.ts";

export interface TypedRedirectResponse<S extends HttpStatusCodes | number, __ = unknown> extends Response {
  readonly status: S;
  readonly redirected: true;
}
export function Redirect<S extends HttpStatusCodes | number, D extends URL | string | typeof Resource>(status: S, destination: D) {
  if (status < 300 || status > 399)
    throw new RangeError(`Invalid redirect status code: ${status}`);

  if (typeof destination === 'function' && 'hono' in destination)
    destination = destination.pathname as D;

  return new Response(
    undefined,
    {
      status,
      headers: {
        [Headers.Location]: destination.toString(),
      },
    },
  ) as TypedRedirectResponse<S, D>;
}

export interface TypedResultResponse<_ = unknown, ___ = unknown> extends Response {}
export function Result<
  S extends HttpStatusCodes | number,
  C extends BodyInit | (() => Iterator<unknown, unknown, unknown> | AsyncIterator<unknown, unknown, unknown>) | number | boolean | object | null,
  T extends ContentTypes | string
>(
  status: S,
  content?: C,
  contentType?: T
): TypedResultResponse<C, T> {
  if ((isBodyInit(content) && contentType !== ContentTypes.Json) || content === undefined || typeof content === "function") {
    const headers = new globalThis.Headers();
    let body;
    if (contentType) headers.set(Headers.ContentType, contentType);
    if (typeof content === "function") {
      body = createReadableFromIterable(content());
      if (contentType?.startsWith(ContentTypes.ServerSentEvent)) {
        body = body.pipeThrough(new TextEncoderStream());
        headers.set(Headers.CacheControl, 'no-cache');
        headers.set(Headers.Connection, 'keep-alive');
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
  readonly methods: RequestMethod[] = Object.values(RequestMethod).filter((method => method in this));
  readonly #parameterMetadata = this.collectParameterMetadata();
  readonly #bodySchema = this.collectParameterSchema('body');
  readonly #querySchema = this.collectParameterSchema('query');
  readonly #routeSchema = this.collectParameterSchema<z.AnyZodObject>('route');
  // readonly #acceptMetadata = this.collectParameterMetadata<ContentTypes[]>(ACCEPT_METADATA_KEY);
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
      const routeSchema = this.#routeSchema.get(method) ?? z.object({});
      const route = Object.keys(routeSchema.shape).map(param => {
        const optional = routeSchema.shape[param].isOptional();
        return `:${param}${optional ? '?' : ''}`;
      }).toReversed().join('/');
      console.log(route)
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

  private collectParameterSchema<T extends z.ZodType>(type: ParameterMetadata['type']) {
    return this.methods.reduce((metadata, method) => {
      const schema = this.#parameterMetadata.get(method)?.filter(metadata => metadata.type === type).reduce((schema: z.ZodType | undefined, metadata) => {
        if (metadata.key) {
          metadata.schema = z.object({ [metadata.key]: metadata.schema });
        }

        if (schema)
          return metadata.schema.merge(schema);
        return metadata.schema;
      }, undefined);
      return metadata.set(method, schema as T);
    }, new Map<RequestMethod, T | undefined>());
  }

  private collectParameterMetadata() {
    return this.methods.reduce((metadata, method) => {
      return metadata.set(method, Reflect.getMetadata(PARAMETER_METADATA_KEY, this, method) ?? []);
    }, new Map<RequestMethod, ParameterMetadata[]>());
  }

  protected static get parent(): typeof Resource | null {
    if (Object.getPrototypeOf(this) === Resource) return null;
    return Object.getPrototypeOf(this);
  }

  protected get parent(): typeof Resource | null {
    if (Object.getPrototypeOf(this.constructor) === Resource) return null;
    return Object.getPrototypeOf(this.constructor);
  }

  public static createClient<T extends typeof Resource>(
    this: T,
    ...[origin]: typeof globalThis extends { location: { origin: string } } ? [origin?: string] : [origin: string]
  ): IResourceClient<T> {
    if (globalThis.location instanceof Location)
      origin ??= globalThis.location.origin;
    else if (typeof origin !== 'string')
      throw new TypeError('origin is required.');

    return new ResourceClient(this, origin) as unknown as IResourceClient<T>;
  }

  public static get methods(): RequestMethod[] {
    return Object.values(RequestMethod).filter((method => method in this.prototype));
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

  public get request(): Request {
    return this.context.req.raw;
  }

  public get response(): Response {
    return this.context.res;
  }

  readonly #OPTIONS: Handler = (context) => {
    context.res.headers.set(Headers.Allow, this.methods.join(', '));
    return Result(HttpStatusCodes.NoContent);
  }

  public clone(context: Context): this {
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
    // this.parseRouteParams(method, context.req, args, issues);
    // this.parseQueryParams(method, context.req, args, issues);
    // if (method !== RequestMethod.Get && method !== RequestMethod.Head)
    //   await this.parseBodyArgs(method, context.req, args, issues);

    if (issues.length)
      throw new BadRequestError('There were issues in your request.', { issues });

    if (Application.instance.state === 'idle')
      await Application.instance.ready;
    const response = await methodHandler(...args, context.req.raw.signal);
    return response ?? Result(HttpStatusCodes.NoContent);
  };

  // private async parseBodyArgs(
  //   method: RequestMethod,
  //   request: HonoRequest,
  //   args: unknown[],
  //   issues: z.ZodIssue[]
  // ) {
  //   const paramMetadata = this.#bodyMetadata.get(method);
  //   if (!paramMetadata) return args;
  //   const acceptedContentTypes: ContentTypes[] = this.#acceptMetadata.get(method) ?? [ContentTypes.Json];
  //   const contentType = request.raw.headers.get(Headers.ContentType) ?? '';
  //   let body;
  //   switch(acceptedContentTypes.find(contentType.startsWith.bind(contentType))) {
  //     case ContentTypes.FormUrlEncoded:
  //     case ContentTypes.MultipartFormData:
  //       body = await request.parseBody();
  //     break;
  //     case ContentTypes.Json:
  //       body = await request.json();
  //     break;
  //     default:
  //       throw new UnsupportedMediaTypeError(`Content type '${contentType}' is unsupported`);
  //   }

  //   for (const metadata of Object.values(paramMetadata)) {
  //     const parseResult = metadata.type.safeParse(body);
  //     if (parseResult.error) {
  //       issues.push(...parseResult.error.issues);
  //     } else {
  //       args[metadata.parameterIndex] = parseResult.data;
  //     }
  //   }
  //   return args;
  // }

  // private parseRouteParams(method: RequestMethod, request: HonoRequest, args: unknown[], issues: z.ZodIssue[]) {
  //   const paramMetadata = this.#routeMetadata.get(method);
  //   if (!paramMetadata) return args;
  //   const params = new Array<string>();
  //   for (const [param, metadata] of Object.entries(paramMetadata).toReversed()) {
  //     params.push(`:${param}`);
  //     // value of path parameter
  //     const value = request.param(param);
  //     const parseResult = metadata.type.safeParse(value);
  //     if (parseResult.error) {
  //       issues.push(...parseResult.error.issues.map(issue => {
  //         // get route up until bad path part
  //         const path = `${this.route}/${params.join('/')}`;
  //         issue.path.push(path);
  //         return issue;
  //       }));
  //     } else {
  //       args[metadata.parameterIndex] = parseResult.data;
  //     }
  //   }
  //   return args;
  // }

  // private parseQueryParams(method: RequestMethod, request: HonoRequest, args: unknown[], issues: z.ZodIssue[]) {
  //   const paramMetadata = this.#queryMetadata.get(method);
  //   if (!paramMetadata) return args;
  //   for (const [param, metadata] of Object.entries(paramMetadata)) {
  //     // value of query parameter
  //     const value = request.query(param);
  //     const parseResult = metadata.type.safeParse(value);
  //     if (parseResult.error) {
  //       issues.push(...parseResult.error.issues.map(issue => {
  //         issue.path.push(`?${param}=`);
  //         return issue;
  //       }));
  //     } else {
  //       args[metadata.parameterIndex] = parseResult.data;
  //     }
  //   }
  //   return args;
  // }
}
