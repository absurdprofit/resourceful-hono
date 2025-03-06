import type { HonoRequest, Handler, Context, MiddlewareHandler } from 'hono';
import { mergePath } from 'hono/utils/url';
import { Hono } from 'hono';
import { z } from 'zod';
import { ACCEPT_METADATA_KEY, DEFAULT_PARAMETER_KEY, MIDDLEWARE_METADATA_KEY, PARAMETER_METADATA_KEY, ROUTE_METADATA_KEY } from './common/constants.ts';
import type { OwnProperties, ParameterMetadata, ResourceMethodReturn, SimpleContentTypeRegistry } from './common/types.ts';
import { isBodyInit } from "./common/types.ts";
import { BadRequestError, MethodNotAllowedError, UnsupportedMediaTypeError } from './common/errors.ts';
import { ContentTypes, Headers, HttpStatusCodes, RequestMethod } from './common/enums.ts';
import { literalToLowerCase } from "./common/utils.ts";
import { Application } from "./Application.ts";
import { ResourceClient, type IResourceClient } from "./ResourceClient.ts";
import { type ContentTypeHandler, ContentTypeRegistry } from "./ContentTypeRegistry.ts";

export interface TypedRedirectResponse<S extends HttpStatusCodes | number, __ = unknown> extends Response {
  readonly status: S;
  readonly redirected: true;
}
export function Redirect<S extends HttpStatusCodes | number, D extends URL | string | typeof Resource>(status: S, destination: D): TypedRedirectResponse<S, D> {
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
export async function Result<
  S extends HttpStatusCodes | number,
  C extends BodyInit | (() => Iterator<unknown, unknown, unknown>) | (() => AsyncIterator<unknown, unknown, unknown>) | number | boolean | object | null | undefined = undefined,
  T extends ContentTypes | string | undefined = undefined
>(
  status: S,
  content?: C,
  contentType?: T
): Promise<TypedResultResponse<C, T>> {
  const headers = new globalThis.Headers();
  let body;
  if (isBodyInit(content)) {
    body = content;
  } else {
    if (!contentType) {
      if (typeof content === 'function')
        contentType = ContentTypes.OctetStream as T;
      else if (typeof content !== 'undefined')
        contentType = ContentTypes.Json as T;
    }

    const { encode } = Resource.contentTypes.get(contentType ?? '') ?? {};
    if (encode)
      body = await encode(content, contentType);
    if (
      contentType?.startsWith(ContentTypes.ServerSentEvent)
      && body instanceof ReadableStream
    ) {
      headers.set(Headers.CacheControl, 'no-cache');
      headers.set(Headers.Connection, 'keep-alive');
    }
  }
  if (contentType) headers.set(Headers.ContentType, contentType);
  return new Response(body, { status, headers });
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
export type NonAbstractResourceLikeConstructor = new (...args: ResourceConstructorArgs) => Resource;
export type AbstractResourceLikeConstructor = abstract new (...args: ResourceConstructorArgs) => Resource;
export type ResourceLikeConstructor = NonAbstractResourceLikeConstructor | AbstractResourceLikeConstructor;
export abstract class Resource implements IResource {
  public context: Context = null!;
  private static readonly contentTypeRegistry = ContentTypeRegistry.default;
  private readonly contentTypeRegistry = new ContentTypeRegistry();
  /**
   * The root hono instance.
   */
  public static readonly hono: Hono = Resource.honoBuilder();
  private readonly hono = Resource.honoBuilder(this);
  readonly methods: RequestMethod[] = Object.values(RequestMethod).filter((method => method in this));
  readonly #parameterMetadata = this.#collectParameterMetadata();
  readonly #bodySchema = this.#collectParameterSchema('body');
  readonly #querySchema = this.#collectParameterSchema('query');
  readonly #routeSchema = this.#collectParameterSchema<z.AnyZodObject>('route');
  readonly #acceptMetadata = this.#collectMethodMetadata<ContentTypes[] | undefined>(ACCEPT_METADATA_KEY);
  readonly #middlewareMetadata = this.#collectMethodMetadata<MiddlewareHandler[]>(MIDDLEWARE_METADATA_KEY);

  constructor() {
    this.#acceptMetadata.entries().forEach(([method, contentTypes]) => {
      contentTypes ??= [ContentTypes.Json];
      contentTypes.forEach((contentType) => {
        const handler = Resource.contentTypes.get(contentType);
        if (handler)
          this.contentTypeRegistry.use(method, contentType, handler);
        else
          throw new ReferenceError(`A handler hasn't been registered for ${contentType}`);
      });
    });

    this.#registerRoutes();
  }

  #registerRoutes() {
    const { hono, handleRequest } = this;
    const methods = this.methods.filter(method => RequestMethod.Head !== method);
    const parentInstance = Object.getPrototypeOf(Object.getPrototypeOf(this));
    if (methods.some(method => Object.hasOwn(parentInstance, method)))
      throw new TypeError(`${this.constructor.name} cannot extend ${parentInstance.constructor.name}. Resources must extend abstract/virtual resources.`);
    // a Resource without methods is no resource at all
    if (!methods.length) return;
    const resourceMiddlewares: MiddlewareHandler[] | undefined = Reflect.getMetadata(MIDDLEWARE_METADATA_KEY, this.constructor);
    for (const method of methods) {
      const routeSchema = this.#routeSchema.get(method) ?? z.object({});
      const route = Object.keys(routeSchema.shape).map(param => {
        const optional = routeSchema.shape[param].isOptional();
        return `:${param}${optional ? '?' : ''}`;
      }).toReversed().join('/');
      resourceMiddlewares?.forEach(middleware =>
        hono[literalToLowerCase(method)](route, middleware)
      );
      this.#middlewareMetadata.get(method)?.forEach(middleware => 
        hono[literalToLowerCase(method)](route, middleware)
      );
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
      throw new TypeError('origin is undefined.');

    return new ResourceClient(this, origin) as unknown as IResourceClient<T>;
  }

  public static get contentTypes(): SimpleContentTypeRegistry {
    return {
      use: (pattern: string | string[], handler: ContentTypeHandler) => {
        return this.contentTypeRegistry.use('*', pattern, handler)
      },
      get: (contentType: string) => {
        return this.contentTypeRegistry.get('*', contentType);
      }
    }
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
    const instance = Object.assign(Object.create(Object.getPrototypeOf(this)), this);
    instance.context = context;
    return instance;
  }

  private readonly handleRequest: Handler = async (context) => {
    const method = context.req.method.toUpperCase() as RequestMethod;
    const methodHandler = (this as IResource)[method]?.bind(this.clone(context));
    const { parameters, issues } = await this.#collectParameters(context.req);

    if (issues.length)
      throw new BadRequestError('There were issues in your request.', { issues });

    if (Application.instance.state === 'idle')
      await Application.instance.ready;
    const response = await methodHandler?.(...parameters, context.req.raw.signal);
    return response ?? Result(HttpStatusCodes.NoContent);
  };

  #parseParameters(type: ParameterMetadata['type'], request: HonoRequest) {
    const method = request.method as RequestMethod;
    switch (type) {
      case 'route':
        return request.param();
      case 'query':
        return request.query();
      case 'body': {
        if (![RequestMethod.Get, RequestMethod.Head].includes(method)) {
          const contentType = request.raw.headers.get(Headers.ContentType) ?? '';
          const handler = this.contentTypeRegistry.get(method, contentType);
          if (handler)
            return handler.decode(request.raw);
          throw new UnsupportedMediaTypeError(`Content type '${contentType}' is unsupported`);
        }
        return {};
      }
      default:
        return {};
    }
  }

  #collectParameterSchema<T extends z.ZodType>(type: ParameterMetadata['type']) {
    return this.methods.reduce((metadata, method) => {
      const schema = this.#parameterMetadata.get(method)?.filter(metadata => metadata.type === type).reduce((schema: z.ZodType | undefined, metadata) => {
        // avoid mutating metadata
        metadata = { ...metadata };
        if (metadata.key) {
          metadata.schema = z.object({ [metadata.key]: metadata.schema });
        }

        if (schema) {
          if (metadata.schema instanceof z.ZodObject && schema instanceof z.ZodObject)
            return metadata.schema.merge(schema);
          return metadata.schema.and(schema);
        }
        return metadata.schema;
      }, undefined);
      return metadata.set(method, schema as T);
    }, new Map<RequestMethod, T | undefined>());
  }

  #collectMethodMetadata<T>(key: symbol) {
    return this.methods.reduce((metadata, method) => {
      return metadata.set(method, Reflect.getMetadata(key, this, method));
    }, new Map<RequestMethod, T>());
  }

  #collectParameterMetadata() {
    return this.methods.reduce((metadata, method) => {
      return metadata.set(method, Reflect.getMetadata(PARAMETER_METADATA_KEY, this, method) ?? []);
    }, new Map<RequestMethod, ParameterMetadata[]>());
  }

  async #collectParameters(request: HonoRequest) {
    const method = request.method as RequestMethod;
    const parameterMetadata = this.#parameterMetadata.get(method) ?? [];
    const issues: z.ZodIssue[] = [];
    let parameters: unknown[] = [];

    if (parameterMetadata.length) {
      const schemas: Record<ParameterMetadata['type'], z.ZodType | undefined> = {
        route: this.#routeSchema.get(method),
        query: this.#querySchema.get(method),
        body: this.#bodySchema.get(method),
      };
      
      const data = Object.fromEntries(
        await Promise.all(
          Object.entries(schemas).map(async ([type, schema]) => {
            if (!schema) return [type, { [DEFAULT_PARAMETER_KEY]: undefined }];
            const result = await schema.safeParseAsync(
              await this.#parseParameters(type as ParameterMetadata['type'], request)
            );
            const parsedData = {...(result['data'] ?? {})};
            parsedData[DEFAULT_PARAMETER_KEY] = result['data'];
            if (!result.success)
              issues.push(...result.error.issues);
      
            return [
              type,
              parsedData,
            ];
          })
        )
      );
  
      parameters = parameterMetadata.map(({ type, key, keys }) => {
        if (!key && keys) {
          // create object with only the expected key-value pairs
          const object = data[type][DEFAULT_PARAMETER_KEY];
          return keys.reduce((parameter, key) => {
            parameter[key] = object?.[key];
            return parameter;
          }, {} as Record<string, unknown>);
        }
        return data[type][key ?? DEFAULT_PARAMETER_KEY];
      });
    }

    return {
      issues,
      parameters,
    };
  }
}
