import { MIDDLEWARE_METADATA_KEY, PARAMETER_METADATA_KEY, ACCEPT_METADATA_KEY, ROUTE_METADATA_KEY } from './constants.ts';
import { z } from 'zod';
import { type ContentTypes, Headers, RequestMethod } from './enums.ts';
import type { NonAbstractResourceLikeConstructor, Resource, ResourceLikeConstructor } from '../Resource.ts';
import type { Constructor, ParameterMetadata, PrimitiveType, ResourceMethod, CacheControlOptions } from './types.ts';
import { Application } from '../Application.ts';
import type { Service } from '../ServiceMap.ts';
import type { Env, MiddlewareHandler } from 'hono';
import { cacheControlFromOptions } from './utils.ts';

/**
 * Defines the accepted content types for a method handler.
 *
 * When applied to a method in a `Resource` class, this decorator attaches metadata
 * indicating which `Content-Type` values the resource accepts in requests.
 *
 * Accepts an array of content type strings.
 * Note: directives (substring after a `;` e.g. `<content-type>; charset=utf-8`) are ignored when matching.
 *
 * @param {ContentTypes[] | string[]} acceptedContentTypes - An array of acceptable content types.
 * @returns {(target: Resource, propertyKey: string) => void} A method decorator applicable to all resource methods.
 *
 * @example
 * ```ts
 * class UserResource extends Resource {
 *   \@Accept(['application/json', 'application/xml'])
 *   public GET() {
 *     // Accepts JSON and XML requests
 *   }
 * }
 * ```
 *
 * @example
 * ```ts
 * class UserResource extends Resource {
 *   \@Accept([ContentTypes.Json]) // default when this decorator isn't specified
 *   public POST() {
 *     // Only accepts JSON requests
 *   }
 * }
 * ```
 */
export function Accept(acceptedContentTypes: ContentTypes[] | string[]): (target: Resource, propertyKey: string) => void {
  return function(target: Resource, propertyKey: string) {
    Reflect.defineMetadata(ACCEPT_METADATA_KEY, acceptedContentTypes, target, propertyKey);
    Reflect.defineMetadata(ACCEPT_METADATA_KEY, acceptedContentTypes, target.constructor, propertyKey);
  };
}

/**
 * Decorator that defined the route for a resource.
 *
 * Throws if path includes params (`:id`) or wildcards (`*`) because
 * those are automatically inferred from method parameters.
 *
 * @param {string} path - The path segment for the resource.
 * @returns {<T extends ResourceLikeConstructor>(target: T) => void} A class decorator applicable to all resources.
 *
 * @example
 * ```ts
 * \@Route('users')
 * class UserResource extends Resource {
 *  // method handlers
 * }
 * ```
 */
export function Route(path: string): <T extends ResourceLikeConstructor>(target: T) => void {
  if (path.includes(':'))
    throw new Error('Your route includes a path param which must be a mistake. Path params are automatically inferred.');
  if (path.includes('*'))
    throw new Error('Your route includes a wildcard which must be a mistake. Wildcards are automatically inferred.');
  return function <T extends ResourceLikeConstructor>(target: T) {
    Object.defineProperty(target, ROUTE_METADATA_KEY, { value: path, writable: false });
  };
}

/**
 * Decorator for declaring route parameters using a Zod object schema.
 *
 * Automatically extracts and validates named parameters from the route based on the schema shape.
 *
 * @param {z.AnyZodObject} schema - Zod object schema describing the expected route parameters.
 * @returns {(target: Resource, propertyKey: ResourceMethod, parameterIndex: number) => void} A parameter decorator applicable to all resource methods.
 *
 * @example
 * ```ts
 * class UserResource extends Resource {
 *   public PUT(\@FromRoute(z.object({ userId: z.string(), postId: z.string() })) params: any) {
 *     // handle PUT
 *   }
 * }
 * 
 * @example
 * ```ts
 * class UserResource extends Resource {
 *   // note: non-string types must be coerced
 *   public PUT(\@FromRoute(z.object({ id: z.coerce.number() })) params: any) {
 *     // handle PUT
 *   }
 * }
 * ```
 */
export function FromRoute(schema: z.AnyZodObject): (target: Resource, propertyKey: ResourceMethod, parameterIndex: number) => void;
/**
 * Decorator for declaring a route parameter using a key and Zod boolean, number or string-like schema.
 *
 * Validates the value of the specified route parameter using the provided schema.
 *
 * @param {string} key - The name of the route parameter.
 * @param {PrimitiveType | z.ZodOptional<PrimitiveType>} schema - Zod schema used to validate the parameter.
 * @returns {(target: Resource, propertyKey: ResourceMethod, parameterIndex: number) => void} A parameter decorator applicable to all resource methods.
 *
 * @example
 * ```ts
 * class UserResource extends Resource {
 *   public GET(\@FromRoute('id', z.string()) id: string) {
 *     // handle GET
 *   }
 * }
 * ```
 * 
 * @example
 * ```ts
 * class UserResource extends Resource {
 *   // note: non-string types must be coerced
 *   public PUT(\@FromRoute('id', z.coerce.number()) params: any) {
 *     // handle PUT
 *   }
 * }
 * ```
 */
export function FromRoute(key: string, schema: PrimitiveType | z.ZodOptional<PrimitiveType>): (target: Resource, propertyKey: ResourceMethod, parameterIndex: number) => void;
export function FromRoute(keyOrSchema: string | z.AnyZodObject, schemaOrUndefined?: PrimitiveType | z.ZodOptional<PrimitiveType>): (target: Resource, propertyKey: ResourceMethod, parameterIndex: number) => void {
  return function (target: Resource, propertyKey: ResourceMethod, parameterIndex: number) {
    const metadata: ParameterMetadata[] = Reflect.getMetadata(PARAMETER_METADATA_KEY, target, propertyKey) ?? [];
    if (metadata[parameterIndex]) throw new Error('Parameter decorators cannot be composed');
    const key = typeof keyOrSchema === 'string' ? keyOrSchema : undefined;
    const schema = typeof keyOrSchema === 'string' ? schemaOrUndefined! : keyOrSchema;
    const keys = schema instanceof z.ZodObject ? Object.keys(schema.shape) : undefined;
    metadata[parameterIndex] = { type: 'route', key, keys, schema };
    Reflect.defineMetadata(PARAMETER_METADATA_KEY, metadata, target, propertyKey);
    Reflect.defineMetadata(PARAMETER_METADATA_KEY, metadata, target.constructor, propertyKey);
    if (propertyKey === RequestMethod.Get) {
      Reflect.defineMetadata(PARAMETER_METADATA_KEY, metadata, target, RequestMethod.Head);
      Reflect.defineMetadata(PARAMETER_METADATA_KEY, metadata, target.constructor, RequestMethod.Head);
    }
  };
}

/**
 * Decorator for declaring query parameters using a Zod object schema.
 *
 * Automatically extracts and validates named parameters from the query based on the schema shape.
 *
 * @param {z.AnyZodObject} schema - Zod object schema describing the expected query parameters.
 * @returns {(target: Resource, propertyKey: ResourceMethod, parameterIndex: number) => void} A parameter decorator applicable to all resource methods.
 *
 * @example
 * ```ts
 * class UserResource extends Resource {
 *   public PUT(\@FromQuery(z.object({ userId: z.string(), postId: z.string() })) params: any) {
 *     // handle PUT
 *   }
 * }
 * 
 * @example
 * ```ts
 * class UserResource extends Resource {
 *   // note: non-string types must be coerced
 *   public PUT(\@FromQuery(z.object({ id: z.coerce.number() })) params: any) {
 *     // handle PUT
 *   }
 * }
 * ```
 */
export function FromQuery(schema: z.ZodType): (target: Resource, propertyKey: ResourceMethod, parameterIndex: number) => void;
/**
 * Decorator for declaring a query parameter using a key and Zod boolean, number or string-like schema.
 *
 * Validates the value of the specified query parameter using the provided schema.
 *
 * @param {string} key - The name of the query parameter.
 * @param {PrimitiveType | z.ZodOptional<PrimitiveType>} schema - Zod schema used to validate the parameter.
 * @returns {(target: Resource, propertyKey: ResourceMethod, parameterIndex: number) => void} A parameter decorator applicable to all resource methods.
 *
 * @example
 * ```ts
 * class UserResource extends Resource {
 *   public GET(\@FromQuery('id', z.string()) id: string) {
 *     // handle GET
 *   }
 * }
 * ```
 * 
 * @example
 * ```ts
 * class UserResource extends Resource {
 *   // note: non-string types must be coerced
 *   public PUT(\@FromQuery('id', z.coerce.number()) params: any) {
 *     // handle PUT
 *   }
 * }
 * ```
 */
export function FromQuery(key: string, schema: z.ZodType): (target: Resource, propertyKey: ResourceMethod, parameterIndex: number) => void;
export function FromQuery(keyOrSchema: string | z.ZodType, schemaOrUndefined?: z.ZodType): (target: Resource, propertyKey: ResourceMethod, parameterIndex: number) => void {
  return function (target: Resource, propertyKey: ResourceMethod, parameterIndex: number) {
    const metadata: ParameterMetadata[] = Reflect.getMetadata(PARAMETER_METADATA_KEY, target, propertyKey) ?? [];
    if (metadata[parameterIndex]) throw new Error('Parameter decorators cannot be composed');
    const key = typeof keyOrSchema === 'string' ? keyOrSchema : undefined;
    const schema = typeof keyOrSchema === 'string' ? schemaOrUndefined! : keyOrSchema;
    const keys = schema instanceof z.ZodObject ? Object.keys(schema.shape) : undefined;
    metadata[parameterIndex] = { type: 'query', key, keys, schema };
    Reflect.defineMetadata(PARAMETER_METADATA_KEY, metadata, target, propertyKey);
    Reflect.defineMetadata(PARAMETER_METADATA_KEY, metadata, target.constructor, propertyKey);
    if (propertyKey === RequestMethod.Get) {
      Reflect.defineMetadata(PARAMETER_METADATA_KEY, metadata, target, RequestMethod.Head);
      Reflect.defineMetadata(PARAMETER_METADATA_KEY, metadata, target.constructor, RequestMethod.Head);
    }
  };
}

/**
 * Decorator for declaring the request body using a Zod schema.
 *
 * Validates the entire request body and injects it into the decorated method.
 *
 * @param {z.ZodType} schema - Zod schema describing the expected structure of the request body.
 * @returns {(target: Resource, propertyKey: Exclude<ResourceMethod, 'GET' | 'HEAD'>, parameterIndex: number) => void} A parameter decorator applicable to resource methods other than GET and HEAD.
 *
 * @example
 * ```ts
 * class PostResource extends Resource {
 *   public POST(\@FromBody(z.object({ title: z.string() })) body: any) {
 *     // handle POST
 *   }
 * }
 * ```
 */
export function FromBody(schema: z.ZodType): (target: Resource, propertyKey: Exclude<ResourceMethod, 'GET' | 'HEAD'>, parameterIndex: number) => void;
/**
 * Decorator for declaring a specific key to be extracted from the request body using a Zod schema.
 *
 * Validates a single field inside the request body and injects only that value.
 *
 * @param {string} key - Key inside the request body to extract.
 * @param {z.ZodType} schema - Zod schema used to validate the selected field.
 * @returns {(target: Resource, propertyKey: Exclude<ResourceMethod, 'GET' | 'HEAD'>, parameterIndex: number) => void} A parameter decorator applicable to resource methods other than GET and HEAD.
 *
 * @example
 * ```ts
 * class PostResource extends Resource {
 *   public PATCH(\@FromBody('title', z.string()) title: string) {
 *     // handle PATCH
 *   }
 * }
 * ```
 */
export function FromBody(key: string, schema: z.ZodType): (target: Resource, propertyKey: Exclude<ResourceMethod, 'GET' | 'HEAD'>, parameterIndex: number) => void;
export function FromBody(keyOrSchema: string | z.ZodType, schemaOrUndefined?: z.ZodType): (target: Resource, propertyKey: Exclude<ResourceMethod, 'GET' | 'HEAD'>, parameterIndex: number) => void {
  return function (target: Resource, propertyKey: Exclude<ResourceMethod, 'GET' | 'HEAD'>, parameterIndex: number) {
    const metadata: ParameterMetadata<z.ZodType>[] = Reflect.getMetadata(PARAMETER_METADATA_KEY, target, propertyKey) ?? [];
    if (metadata[parameterIndex]) throw new Error('Parameter decorators cannot be composed');
    const key = typeof keyOrSchema === 'string' ? keyOrSchema : undefined;
    const schema = typeof keyOrSchema === 'string' ? schemaOrUndefined! : keyOrSchema;
    const keys = schema instanceof z.ZodObject ? Object.keys(schema.shape) : undefined;
    metadata[parameterIndex] = { type: 'body', key, keys, schema };
    Reflect.defineMetadata(PARAMETER_METADATA_KEY, metadata, target, propertyKey);
    Reflect.defineMetadata(PARAMETER_METADATA_KEY, metadata, target.constructor, propertyKey);
  };
}

/**
 * Decorator for declaring service injection.
 *
 * Retrieves the service instance from the Application service collection.
 *
 * @param {Constructor<Service>} [type] - The service class to inject. Optional if the type can be automatically inferred, throws an error otherwise.
 * @returns {PropertyDecorator} A property decorator applicable to all class fields.
 *
  * @example
 * ```ts
 * class UserService {
 *   \@Inject()
 *   declare private logService: LogService;
 *
 *   public getAll() {
 *     this.logService.info('Get users');
 *     return [{ name: 'Nathan Johnson' }];
 *   }
 * }
 * ```
 * 
 * @example
 * ```ts
 * class UserResource extends Resource {
 *   \@Inject()
 *   declare private userService: UserService;
 *
 *   public GET() {
 *     return Result(HttpStatusCodes.Ok, this.userService.getAll());
 *   }
 * }
 * ```
 */
export function Inject(type?: Constructor<Service>): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol) {
    type = type ?? Reflect.getMetadata('design:type', target, propertyKey);
    let instance;
    if (!type) throw new Error(`Could not determine type for property ${propertyKey.toString()}`);
    Object.defineProperty(target, propertyKey, {
      get: () => {
        instance ??= Application.instance.getService(type!);
        return instance;
      },
    });
  };
}

/**
 * Decorator to register a middleware handler for a resource class or method.
 *
 * When applied to a class, the middleware runs before all methods.
 * When applied to a method, the middleware runs before that specific method.
 *
 * @param {MiddlewareHandler} middleware - The Hono middleware function to apply.
 * @returns {<T extends NonAbstractResourceLikeConstructor | Resource>(target: T, propertyKey?: ResourceMethod) => void} A decorator applicable to all resource classes and resource class methods.
 *
 * @example
 * ```ts
 * const Protect: MiddlewareHandler = async (context, next) => {
 *   const oauth = Application.instance.getService(AuthService);
 *   const authorization = context.req.header('Authorization');
 *   if (!oauth.validate(authorization))
 *    throw new UnauthorizedError('Invalid token');
 *   return next();
 * };
 *
 * \@Middleware(Protect)
 * class PostResource extends Resource {
 *   public GET() {
 *     // protected
 *   }
 *
 *   \@Middleware((_, next) => { console.log('Logging'); return next(); })
 *   public POST() {
 *     // has both Protect and Logger middleware
 *   }
 * }
 * ```
 */
export function Middleware<E extends Env>(middleware: MiddlewareHandler<E>):
  <T extends NonAbstractResourceLikeConstructor | Resource>(
    target: T,
    propertyKey?: ResourceMethod
  ) => void {
  return function <T extends NonAbstractResourceLikeConstructor | Resource>(target: T, propertyKey?: ResourceMethod): void {
    if (propertyKey) {
      const middlewares: MiddlewareHandler[] = Reflect.getMetadata(MIDDLEWARE_METADATA_KEY, target, propertyKey) ?? [];
      middlewares.push(middleware);
      Reflect.defineMetadata(MIDDLEWARE_METADATA_KEY, middlewares, target, propertyKey);
    } else {
      const middlewares: MiddlewareHandler[] = Reflect.getMetadata(MIDDLEWARE_METADATA_KEY, target) ?? [];
      middlewares.push(middleware);
      Reflect.defineMetadata(MIDDLEWARE_METADATA_KEY, middlewares, target);
    }
  };
}

export function CacheControl(options: CacheControlOptions) {
  return Middleware(async (context, next) => {
    await next();
    context.res.headers.set(
      Headers.CacheControl,
      cacheControlFromOptions(options)
    );
  });
}