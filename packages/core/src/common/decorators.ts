import { PARAMETER_METADATA_KEY, ACCEPT_METADATA_KEY, ROUTE_METADATA_KEY } from './constants.ts';
import type { z } from 'npm:zod@3.24.1';
import { type ContentTypes, RequestMethod } from "./enums.ts";
import type { IResource, ResourceLikeConstructor } from "../Resource.ts";
import type { Constructor, ParameterMetadata, PrimitiveType, ResourceMethod } from "./types.ts";
import { Application } from "../Application.ts";
import { Service } from "../ServiceMap.ts";

export function Accept(acceptedContentTypes: ContentTypes[]): (target: IResource, propertyKey: string) => void {
  return function(target: IResource, propertyKey: string) {
    Reflect.defineMetadata(ACCEPT_METADATA_KEY, acceptedContentTypes, target, propertyKey);
    Reflect.defineMetadata(ACCEPT_METADATA_KEY, acceptedContentTypes, target.constructor, propertyKey);
  }
}
export function Route(path: string): <T extends ResourceLikeConstructor>(target: T) => void {
  if (path.includes(':'))
    throw new Error('Your route includes a path param which must be a mistake. Path params are automatically inferred.');
  return function <T extends ResourceLikeConstructor>(target: T) {
    Object.defineProperty(target, ROUTE_METADATA_KEY, { value: path, writable: false });
  }
}
export function FromRoute(schema: z.AnyZodObject): (target: IResource, propertyKey: ResourceMethod, parameterIndex: number) => void;
export function FromRoute(key: string, schema: PrimitiveType): (target: IResource, propertyKey: ResourceMethod, parameterIndex: number) => void;
export function FromRoute(keyOrSchema: string | z.AnyZodObject, schemaOrUndefined?: PrimitiveType): (target: IResource, propertyKey: ResourceMethod, parameterIndex: number) => void {
  return function (target: IResource, propertyKey: ResourceMethod, parameterIndex: number) {
    const metadata: ParameterMetadata[] = Reflect.getMetadata(PARAMETER_METADATA_KEY, target, propertyKey) ?? [];
    if (metadata[parameterIndex]) throw new Error('Parameter decorators cannot be composed');
    const key = typeof keyOrSchema === 'string' ? keyOrSchema : undefined;
    const schema = typeof keyOrSchema === 'string' ? schemaOrUndefined! : keyOrSchema;
    metadata[parameterIndex] = { type: 'route', key, schema };
    Reflect.defineMetadata(PARAMETER_METADATA_KEY, metadata, target, propertyKey);
    Reflect.defineMetadata(PARAMETER_METADATA_KEY, metadata, target.constructor, propertyKey);
    if (propertyKey === RequestMethod.Get) {
      Reflect.defineMetadata(PARAMETER_METADATA_KEY, metadata, target, RequestMethod.Head);
      Reflect.defineMetadata(PARAMETER_METADATA_KEY, metadata, target.constructor, RequestMethod.Head);
    }
  }
}
export function FromQuery(schema: z.AnyZodObject): (target: IResource, propertyKey: ResourceMethod, parameterIndex: number) => void;
export function FromQuery(key: string, schema: PrimitiveType): (target: IResource, propertyKey: ResourceMethod, parameterIndex: number) => void;
export function FromQuery(keyOrSchema: string | z.AnyZodObject, schemaOrUndefined?: PrimitiveType): (target: IResource, propertyKey: ResourceMethod, parameterIndex: number) => void {
  return function (target: IResource, propertyKey: ResourceMethod, parameterIndex: number) {
    const metadata: ParameterMetadata[] = Reflect.getMetadata(PARAMETER_METADATA_KEY, target, propertyKey) ?? [];
    if (metadata[parameterIndex]) throw new Error('Parameter decorators cannot be composed');
    const key = typeof keyOrSchema === 'string' ? keyOrSchema : undefined;
    const schema = typeof keyOrSchema === 'string' ? schemaOrUndefined! : keyOrSchema;
    metadata[parameterIndex] = { type: 'query', key, schema };
    Reflect.defineMetadata(PARAMETER_METADATA_KEY, metadata, target, propertyKey);
    Reflect.defineMetadata(PARAMETER_METADATA_KEY, metadata, target.constructor, propertyKey);
    if (propertyKey === RequestMethod.Get) {
      Reflect.defineMetadata(PARAMETER_METADATA_KEY, metadata, target, RequestMethod.Head);
      Reflect.defineMetadata(PARAMETER_METADATA_KEY, metadata, target.constructor, RequestMethod.Head);
    }
  }
}
export function FromBody(schema: z.ZodType): (target: IResource, propertyKey: Exclude<ResourceMethod, 'GET' | 'HEAD'>, parameterIndex: number) => void
export function FromBody(key: string, schema: z.ZodType): (target: IResource, propertyKey: Exclude<ResourceMethod, 'GET' | 'HEAD'>, parameterIndex: number) => void
export function FromBody(keyOrSchema: string | z.ZodType, schemaOrUndefined?: z.ZodType): (target: IResource, propertyKey: Exclude<ResourceMethod, 'GET' | 'HEAD'>, parameterIndex: number) => void {
  return function (target: IResource, propertyKey: Exclude<ResourceMethod, 'GET' | 'HEAD'>, parameterIndex: number) {
    const metadata: ParameterMetadata<z.ZodType>[] = Reflect.getMetadata(PARAMETER_METADATA_KEY, target, propertyKey) ?? [];
    if (metadata[parameterIndex]) throw new Error('Parameter decorators cannot be composed');
    const key = typeof keyOrSchema === 'string' ? keyOrSchema : undefined;
    const schema = typeof keyOrSchema === 'string' ? schemaOrUndefined! : keyOrSchema;
    metadata[parameterIndex] = { type: 'body', key, schema };
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
