import { MIDDLEWARE_METADATA_KEY, PARAMETER_METADATA_KEY, ACCEPT_METADATA_KEY, ROUTE_METADATA_KEY } from './constants.ts';
import { z } from 'zod';
import { type ContentTypes, RequestMethod } from "./enums.ts";
import type { NonAbstractResourceLikeConstructor, Resource, ResourceLikeConstructor } from "../Resource.ts";
import type { Constructor, ParameterMetadata, PrimitiveType, ResourceMethod } from "./types.ts";
import { Application } from "../Application.ts";
import type { Service } from "../ServiceMap.ts";
import type { MiddlewareHandler } from "hono";

export function Accept(acceptedContentTypes: ContentTypes | string[]): (target: Resource, propertyKey: string) => void {
  return function(target: Resource, propertyKey: string) {
    Reflect.defineMetadata(ACCEPT_METADATA_KEY, acceptedContentTypes, target, propertyKey);
    Reflect.defineMetadata(ACCEPT_METADATA_KEY, acceptedContentTypes, target.constructor, propertyKey);
  }
}
export function Route(path: string): <T extends ResourceLikeConstructor>(target: T) => void {
  if (path.includes(':'))
    throw new Error('Your route includes a path param which must be a mistake. Path params are automatically inferred.');
  if (path.includes('*'))
    throw new Error('Your route includes a wildcard which must be a mistake. Wildcards are automatically inferred.');
  return function <T extends ResourceLikeConstructor>(target: T) {
    Object.defineProperty(target, ROUTE_METADATA_KEY, { value: path, writable: false });
  }
}
export function FromRoute(schema: z.AnyZodObject): (target: Resource, propertyKey: ResourceMethod, parameterIndex: number) => void;
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
  }
}
export function FromQuery(schema: z.AnyZodObject): (target: Resource, propertyKey: ResourceMethod, parameterIndex: number) => void;
export function FromQuery(key: string, schema: PrimitiveType | z.ZodOptional<PrimitiveType>): (target: Resource, propertyKey: ResourceMethod, parameterIndex: number) => void;
export function FromQuery(keyOrSchema: string | z.AnyZodObject, schemaOrUndefined?: PrimitiveType | z.ZodOptional<PrimitiveType>): (target: Resource, propertyKey: ResourceMethod, parameterIndex: number) => void {
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
  }
}
export function FromBody(schema: z.ZodType): (target: Resource, propertyKey: Exclude<ResourceMethod, 'GET' | 'HEAD'>, parameterIndex: number) => void
export function FromBody(key: string, schema: z.ZodType): (target: Resource, propertyKey: Exclude<ResourceMethod, 'GET' | 'HEAD'>, parameterIndex: number) => void
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
  }
}

export function Inject(type?: Constructor<Service>): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol) {
    type = type ?? Reflect.getMetadata('design:type', target, propertyKey);
    Object.defineProperty(target, propertyKey, {
      get: () => {
        if (!type) throw new Error(`Could not determine type for property ${propertyKey.toString()}`);
        return Application.instance.getService(type);
      },
    });
  };
}

export function Middleware(middleware: MiddlewareHandler):  <T extends NonAbstractResourceLikeConstructor | Resource>(target: T, propertyKey?: ResourceMethod) => void {
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
  }
}
