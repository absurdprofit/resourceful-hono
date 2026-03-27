import type { Hono, HonoRequest, Handler, Context, MiddlewareHandler } from 'hono';
import { mergePath } from 'hono/utils/url';
import { z } from 'zod';
import { ACCEPT_METADATA_KEY, DEFAULT_PARAMETER_KEY, FIRST_INDEX, INVALID_PAYLOAD_ERROR, MIDDLEWARE_METADATA_KEY, PARAMETER_METADATA_KEY, ROUTE_METADATA_KEY, SINGLE_ELEMENT_LENGTH } from './common/constants.ts';
import type { DefaultContextVariables, ParameterMetadata, ResourceMethodReturn, SimpleContentTypeRegistry } from './common/types.ts';
import { isBodyInit } from './common/types.ts';
import { BadRequestError, MethodNotAllowedError, UnsupportedMediaTypeError } from './common/errors.ts';
import { ContentTypes, Headers, HttpStatusCodes, RequestMethod } from './common/enums.ts';
import { type honoBuilder, literalToLowerCase, decodeQuery, encodeQuery } from './common/utils.ts';
import type { Application } from './Application.ts';
import { ResourceClient } from './ResourceClient.ts';
import { type ContentTypeHandler, ContentTypeRegistry } from './ContentTypeRegistry.ts';
import type { ResourceClientInstance } from './index.ts';
import { ResponseEvent } from './common/events.ts';
import { toKebabCase } from '@std/text';

export interface TypedRedirectResponse<S extends HttpStatusCodes | number, __ = unknown> extends Response {
  readonly status: S;
  readonly redirected: true;
}
/**
 * Creates a typed HTTP redirect response with a `Location` header.
 *
 * Only supports status codes in the 3xx range (300–399). Throws for invalid codes.
 * Accepts destinations as a `string`, `URL`, or a `Resource` class with a `pathname`.
 *
 * @param {HttpStatusCodes | number} status - HTTP status code (must be in the 3xx range).
 * @param {URL | string | typeof Resource} destination - Destination URL or resource class.
 * @returns {TypedRedirectResponse<S, D>} A typed redirect `Response` with a `Location` header.
 *
 * @throws {RangeError}
 *
 * @example
 * ```ts
 * return Redirect(302, '/login'); // string path
 *
 * return Redirect(301, new URL('https://example.com')); // URL object
 *
 * return Redirect(307, UserResource); // redirect to resource's route
 * ```
 */
export function Redirect<S extends HttpStatusCodes | number, D extends URL | string | typeof Resource>(status: S, destination: D): TypedRedirectResponse<S, D> {
  // 300 - 399
  if (status >= HttpStatusCodes.MultipleChoices && status < HttpStatusCodes.BadRequest) {
    if (typeof destination === 'function')
      destination = destination.pathname as D;
  
    return new Response(
      undefined,
      {
        status,
        headers: {
          [Headers.Location]: destination.toString(),
          [Headers.CacheControl]: 'no-store',
        },
      }
    ) as TypedRedirectResponse<S, D>;
  } else {
    throw new RangeError(`Invalid redirect status code: ${status}`);
  }
}

export interface TypedResultResponse<S extends HttpStatusCodes | number, _ = unknown, __ = unknown> extends Response {
  readonly status: S;
}

export interface TypedPagedResultResponse<S extends HttpStatusCodes | number, _ = unknown, __ = unknown, ___ = unknown> extends Response {
  readonly status: S;
}

// Cache the date header value to avoid regenerating it for every response within the same second.
// This is a performance optimization based on the fact that the Date header only needs to be accurate to the second.
const SECOND_IN_MS = 1000;
function DATE_GENERATOR() {
  let last = Date.now();
  let value = new Date().toUTCString();

  return () => {
    const now = Date.now();

    if (now - last >= SECOND_IN_MS) {
      last = now;
      value = new Date().toUTCString();
    }

    return value;
  };
}
const date = DATE_GENERATOR();

/**
 * Creates a typed HTTP response with optional encoding based on content type.
 *
 * Automatically handles common `Content-Type` inference and encoding:
 * - If `content` is a `BodyInit`, it is used as-is.
 * - If `content` is a function (e.g. stream iterator), the content type defaults to `application/octet-stream`.
 * - If `content` is a serializable object or primitive, it defaults to `application/json`.
 * - If `contentType` is explicitly provided, it overrides defaults.
 * - Automatically sets headers like `Date` and `Content-Type`.
 * - Applies SSE-specific headers for `text/event-stream`.
 *
 * @param {HttpStatusCodes | number} status - HTTP status code (e.g. 200, 404).
 * @param {BodyInit | (() => Iterator<unknown, unknown, unknown>) | (() => AsyncIterator<unknown, unknown, unknown>) | number | boolean | object | null | undefined} content - Optional esponse content (can be `BodyInit`, function, object, etc.).
 * @param {ContentTypes | string | undefined} [contentType] - Optional MIME type as string (e.g. `'application/json'`).
 * @returns {Promise<TypedResultResponse<S, C, T>>} A typed `Response` with applied headers and encoded body.
 *
 * @example
 * ```ts
 * return Result(200, { message: 'OK' }); // Defaults to application/json
 *
 * return Result(204); // No content
 *
 * return Result(200, function* () { yield 1; }); // Octet-stream, auto-inferred
 *
 * return Result(200, '<h1>Hello</h1>', 'text/html'); // Custom content-type
 * ```
 */
export async function Result<
  S extends HttpStatusCodes | number,
  C extends BodyInit | (() => Iterator<unknown, unknown, unknown>) | (() => AsyncIterator<unknown, unknown, unknown>) | number | boolean | object | null | undefined = undefined,
  T extends ContentTypes | string | undefined = undefined
>(
  status: S,
  content?: C,
  contentType?: T
): Promise<TypedResultResponse<S, C, T>> {
  const headers: [string, string][] = [
    [Headers.Date, date()],
    [Headers.CacheControl, 'no-store'],
  ];

  let body: C | BodyInit | null | undefined = content;
  if (contentType || !isBodyInit(body)) {
    if (!contentType) {
      switch (typeof content) {
        case 'function':
          contentType = ContentTypes.OctetStream as T;
          break;
        case 'undefined':
          return new Response(undefined, { status, headers }) as TypedResultResponse<S, C, T>;
        default:
          contentType = ContentTypes.Json as T;
      }
    }

    headers.push([Headers.ContentType, contentType!]);

    if (
      contentType?.startsWith(ContentTypes.ServerSentEvent)
    ) {
      headers.push(
        [Headers.CacheControl, 'no-cache'],
        [Headers.Connection, 'keep-alive']
      );
    }

    body = await Resource
      .contentTypes
      .get(contentType!)
      ?.encode(body, contentType);
  }
  return new Response(
    body as BodyInit | null | undefined,
    { status, headers }
  ) as TypedResultResponse<S, C, T>;
}

export async function PagedResult<
  S extends HttpStatusCodes | number,
  C extends BodyInit | (() => Iterator<unknown, unknown, unknown>) | (() => AsyncIterator<unknown, unknown, unknown>) | number | boolean | object | null | undefined = undefined,
  P extends Record<string, unknown> = Record<string, unknown>,
  T extends ContentTypes | string | undefined = undefined
>(
  status: S,
  content?: {
    body: C;
    meta?: {
      url: string;
      pagination?: P;
    }
  },
  contentType?: T
  
): Promise<TypedPagedResultResponse<S, C, P, T>> {
  const headers: [string, string][] = [
    [Headers.Date, date()],
  ];

  if (content?.meta) {
    const { url, pagination = {} } = content.meta;
    const linkUrl = new URL(url);
    const linkParts: string[] = [];
    for (const [rel, link] of Object.entries(pagination)) {
      if (!link) continue;
      linkUrl.search = encodeQuery(link);
      linkParts.push(`<${linkUrl.href}>; rel="${rel}"`);
    }

    if (linkParts.length)
      headers.push([Headers.Link, linkParts.join(', ')]);
  }

  let body: C | BodyInit | null | undefined = content?.body;
  if (contentType || !isBodyInit(body)) {
    if (!contentType) {
      switch (typeof content) {
        case 'function':
          contentType = ContentTypes.OctetStream as T;
          break;
        case 'undefined':
          return new Response(undefined, { status, headers }) as TypedPagedResultResponse<S, C, P, T>;
        default:
          contentType = ContentTypes.Json as T;
      }
    }

    headers.push([Headers.ContentType, contentType!]);

    if (
      contentType?.startsWith(ContentTypes.ServerSentEvent)
    ) {
      headers.push(
        [Headers.CacheControl, 'no-cache'],
        [Headers.Connection, 'keep-alive']
      );
    }

    body = await Resource
      .contentTypes
      .get(contentType!)
      ?.encode(body, contentType);
  }
  return new Response(
    body as BodyInit | null | undefined,
    { status, headers }
  ) as TypedPagedResultResponse<S, C, P, T>;
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
type ResourceConstructorArgs = [Application, typeof honoBuilder];
export type NonAbstractResourceLikeConstructor = new (...args: ResourceConstructorArgs) => Resource;
export type AbstractResourceLikeConstructor = abstract new (...args: ResourceConstructorArgs) => Resource;
export type ResourceLikeConstructor = NonAbstractResourceLikeConstructor | AbstractResourceLikeConstructor;
export abstract class Resource implements IResource {
  public context: Context<{ Variables: DefaultContextVariables }> = null!;
  private static readonly contentTypeRegistry = ContentTypeRegistry.default;
  private readonly contentTypeRegistry = new ContentTypeRegistry();
  /**
   * Exposes a simplified interface for registering and retrieving content type handlers.
   *
   * @returns {SimpleContentTypeRegistry} A reference to the global content type registry.
   *
   * @example
   * ```ts
   * // Register a custom content type
   * Resource.contentTypes.use('application/vnd.custom+json', {
   *   encode: (data) => JSON.stringify(data),
   *   decode: async (req) => await req.json()
   * });
   *
   * // Later use in Accept decorator
   * class UserResource extends Resource {
   *   \@Accept(['application/vnd.custom+json'])
   *   public POST() {
   *     // handle POST
   *   }
   * }
   * ```
   * ```
   */
  public static readonly contentTypes: SimpleContentTypeRegistry = {
    use: (pattern: string | string[], handler: ContentTypeHandler) => {
      return this.contentTypeRegistry.use('*', pattern, handler);
    },
    get: (contentType: string) => {
      return this.contentTypeRegistry.get('*', contentType);
    },
  };
  
  readonly #hono;
  /**
   * List of HTTP methods implemented by this resource instance.
   *
   * @readonly
   *
   * @example
   * ```ts
   * class PostResource extends Resource {
   *   public GET() {}
   *   public POST() {}
   * }
   *
   * const res = new PostResource();
   * console.log(res.methods); // ['GET', 'POST']
   * ```
   */
  protected readonly application: Application;
  public readonly methods: RequestMethod[] = Object.values(RequestMethod).filter((method => method in this));
  readonly #parameterMetadata = this.#collectParameterMetadata();
  readonly #bodySchema = this.#collectParameterSchema('body');
  readonly #querySchema = this.#collectParameterSchema('query');
  readonly #routeSchema = this.#collectParameterSchema<z.AnyZodObject>('route');
  readonly #acceptMetadata = this.#collectMethodMetadata<ContentTypes[] | undefined>(ACCEPT_METADATA_KEY);
  readonly #middlewareMetadata = this.#collectMethodMetadata<MiddlewareHandler[]>(MIDDLEWARE_METADATA_KEY);
  static #activeRequests = Number();

  constructor(application: Application, Hono: typeof honoBuilder) {
    this.application = application;
    this.#hono = Hono(this);
    [...this.#acceptMetadata.entries()].forEach(([method, contentTypes]) => {
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
    const hono = this.#hono;
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
      hono[literalToLowerCase(method)](route, this.#handleRequest);
    }
    hono.options('*', this.#OPTIONS);
    hono.all('*', this.#methodNotAllowed);
    this.application.hono.route('', hono);
  }

  #methodNotAllowed(): Response {
    throw new MethodNotAllowedError();
  }

  public static get parent(): typeof Resource | null {
    if (Object.getPrototypeOf(this) === Resource) return null;
    return Object.getPrototypeOf(this);
  }

  public get parent(): typeof Resource | null {
    if (Object.getPrototypeOf(this.constructor) === Resource) return null;
    return Object.getPrototypeOf(this.constructor);
  }

  /**
   * Creates a client instance for the given `Resource` subclass.
   *
   * This is a static method intended to be called directly from a `Resource` class.
   * It optionally accepts an `origin`, which defaults to `window.location.origin` in browser environments.
   *
   * If running in environments without `globalThis.location.origin`, the `origin` argument is required.
   *
   * @param {string} [origin] - Optional base URL to use for the client. Required in non-browser environments.
   * @returns {ResourceClientInstance<this>} A typed ResourceClient.
   *
   * @example
   * ```ts
   * class UserResource extends Resource {
   *   public GET() {
   *     return Result(200, [{ name: 'Nathan Johnson' }]);
   *   }
   * }
   *
   * const client = UserResource.createClient();
   * const result = await client.GET(); // Fully typed result
   * const result = await client.get(); // lowercase alias
   * ```
   */
  public static createClient<R extends Resource, RC extends ResourceClientInstance<R>>(
    this: new (...args: ResourceConstructorArgs) => R,
    ...[origin]: typeof globalThis extends { location: { origin: string } } ? [origin?: string] : [origin: string]
  ): RC {
    return new ResourceClient(this, origin) as RC;
  }

  /**
   * List of HTTP methods implemented by this resource instance.
   *
   * @readonly
   *
   * @example
   * ```ts
   * class PostResource extends Resource {
   *   public GET() {}
   *   public POST() {}
   * }
   *
   * const res = new PostResource();
   * console.log(res.methods); // ['GET', 'POST']
   * ```
   */
  public static get methods(): RequestMethod[] {
    return Object
      .values(RequestMethod)
      .filter((method => method in this.prototype));
  }

  /**
   * Returns the route declared or inferred on the resource class.
   *
   * If the class has explicit `@Route` decorator, that value is returned.
   * Otherwise, it defaults to the lowercase class name with `'resource'` stripped out.
   *
   * @returns {string} The route for the resource.
   *
   * @example
   * ```ts
   * \@Route('users')
   * class UserResource extends Resource {}
   *
   * console.log(UserResource.route); // "/users"
   *
   * class FallbackResource extends Resource {}
   * console.log(FallbackResource.route); // "fallback"
   * ```
   */
  public static get route(): string {
    return Object.getOwnPropertyDescriptor(this, ROUTE_METADATA_KEY)?.value ?? toKebabCase(this.name).replace(/-resource$/, '');
  }

  /**
   * Resolves the full pathname for the resource, including any nested parent path.
   *
   * If the resource is sub-classed from a void resource, the base resource's `pathname` is prepended to this resource's `route`.
   *
   * @returns {string} The full merged pathname.
   *
   * @example
   * ```ts
   * \@Route('/api/v1')
   * class BaseResource extends Resource {}
   *
   * \@Route('posts')
   * class PostResource extends BaseResource {}
   *
   * console.log(PostResource.pathname); // "/api/v1/posts"
   * ```
   */
  public static get pathname(): string {
    return mergePath(this.parent?.pathname ?? '', this.route);
  }

  public static get activeRequests(): number {
    return this.#activeRequests;
  }

  /**
   * Returns the route declared or inferred on the resource class.
   *
   * If the class has explicit `@Route` decorator, that value is returned.
   * Otherwise, it defaults to the lowercase class name with `'resource'` stripped out.
   *
   * @returns {string} The route for the resource.
   *
   * @example
   * ```ts
   * \@Route('users')
   * class UserResource extends Resource {}
   *
   * console.log(UserResource.route); // "/users"
   *
   * class FallbackResource extends Resource {}
   * console.log(FallbackResource.route); // "fallback"
   * ```
   */
  public get route(): string {
    return (this.constructor as typeof Resource).route;
  }

  /**
   * Returns the `Request` object associated with the resource instance.
   *
   * Useful when direct access to headers, body, or other low-level request properties is needed.
   *
   * @returns {Request} A native `Request` instance.
   *
   * @example
   * ```ts
   * class UserResource extends Resource {
   *   public GET() {
   *     const request = this.request; // same as this.context.raw.req
   *     const userAgent = request.headers.get('user-agent');
   *     return Result(200, { userAgent });
   *   }
   * }
   * ```
   */
  public get request(): Request {
    return this.context.req.raw;
  }

  /**
   * Returns the `Response` object associated with the resource instance.
   *
   * Useful for setting headers, status codes, or streaming custom responses.
   *
   * @returns {Response} A native `Response` instance.
   *
   * @example
   * ```ts
   * class HealthResource extends Resource {
   *   public GET() {
   *     this.response.headers.set('X-Health-Check', 'true');
   *     return Result(200, { ok: true });
   *   }
   * }
   * ```
   */
  public get response(): Response {
    return this.context.res;
  }

  public get origin(): string {
    return new URL(this.request.url).origin;
  }

  readonly #OPTIONS: Handler = (context) => {
    context.res.headers.set(Headers.Allow, this.methods.join(', '));
    return Result(HttpStatusCodes.NoContent);
  };

  #clone(context: Context): this & IResource {
    const instance = Object.assign(Object.create(Object.getPrototypeOf(this)), this);
    instance.context = context;
    return instance;
  }

  readonly #handleRequest: Handler = async (context) => {
    try {
      Resource.#activeRequests++;
      const method = context.req.method as RequestMethod;
      const clone = this.#clone(context);
      const { parameters, issues } = await this.#collectParameters(context.req);

      if (issues.length)
        throw new BadRequestError('There were issues in your request.', { issues });

      const response = await clone[method]?.call(clone, ...parameters, context.req.raw.signal);
      return response ?? Result(HttpStatusCodes.NoContent);
    } finally {
      context.set('activeRequests', --Resource.#activeRequests);
      this.application.dispatchEvent(new ResponseEvent(context));
    }
  };

  #parseParameters(type: ParameterMetadata['type'], request: HonoRequest) {
    const method = request.method as RequestMethod;
    switch (type) {
      case 'route':
        return request.param();
      case 'query':
        return decodeQuery(Object.entries(request.query()));
      case 'body': {
        if (![RequestMethod.Get, RequestMethod.Head].includes(method)) {
          const contentType = request.raw.headers.get(Headers.ContentType) ?? '';
          const handler = this.contentTypeRegistry.get(method, contentType);
          if (handler)
            return handler.decode(request.raw)
              .catch(() => {
                throw INVALID_PAYLOAD_ERROR;
              });
          request.raw.body?.cancel();
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

    const schemas: [ParameterMetadata['type'], z.ZodType | undefined][] = [
      ['route', this.#routeSchema.get(method)],
      ['query', this.#querySchema.get(method)],
      ['body', this.#bodySchema.get(method)],
    ];
    
    type ParameterData = Record<string, unknown> & {
      [DEFAULT_PARAMETER_KEY]: Record<string, unknown> | undefined;
    };
    const data: Record<string, ParameterData> = {};
    await Promise.all(
      schemas.map(async ([type, schema]) => {
        if (!schema) return data[type] = { [DEFAULT_PARAMETER_KEY]: undefined };
        const result = await schema.safeParseAsync(
          await this.#parseParameters(type, request)
        );
        const parsedData = { ...(result['data'] ?? {}) };
        parsedData[DEFAULT_PARAMETER_KEY] = result['data'];
        if (!result.success)
          issues.push(...result.error.issues);
    
        data[type] = parsedData;
      })
    );

    const parameters: unknown[] = new Array(parameterMetadata.length);
    for (let i = FIRST_INDEX; i < parameterMetadata.length; i++) {
      const { type, key, keys } = parameterMetadata[i];
      if (!key && keys) {
        const obj = data[type][DEFAULT_PARAMETER_KEY] || {};
        const subset: Record<string, unknown> = {};
        for (let j = FIRST_INDEX; j < keys.length; j++) {
          const k = keys[j];
          subset[k] = obj[k];
        }
        parameters[i] = subset;
      } else {
        parameters[i] = data[type][key ?? DEFAULT_PARAMETER_KEY];
      }
    }

    return {
      issues,
      parameters,
    };
  }
}
