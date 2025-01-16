import { BODY_METADATA_KEY, QUERY_METADATA_KEY, ACCEPT_METADATA_KEY, ROUTE_METADATA_KEY } from './constants.ts';
import type { z } from 'npm:zod@3.24.1';
import { type ContentTypes, RequestMethod } from "./enums.ts";
import type { IResource, ResourceLikeConstructor } from "../Resource.ts";
import type { Constructor, ParameterMetadata, PrimitiveType, ResourceMethod } from "./types.ts";
import { Application } from "../Application.ts";
import { Service } from "../ServiceMap.ts";

export function Accept(acceptedContentTypes: ContentTypes[]): (target: IResource, propertyKey: string) => void {
  function AcceptFactory(target: IResource, propertyKey: string) {
    Reflect.defineMetadata(ACCEPT_METADATA_KEY, acceptedContentTypes, target, propertyKey);
  }
  return AcceptFactory;
}
export function Route(path: string): <T extends ResourceLikeConstructor>(target: T) => void {
  if (path.includes(':'))
    throw new Error('Your route includes a path param which must be a mistake. Path params are automatically inferred.');
  return function <T extends ResourceLikeConstructor>(target: T) {
    Object.defineProperty(target, ROUTE_METADATA_KEY, { value: path, writable: false });
  }
}
export function FromRoute(key: string, type: PrimitiveType): (target: IResource, propertyKey: ResourceMethod, parameterIndex: number) => void {
  return function (target: IResource, propertyKey: ResourceMethod, parameterIndex: number) {
    const metadata: ParameterMetadata = Reflect.getMetadata(ROUTE_METADATA_KEY, target, propertyKey) ?? {};
    metadata[key] = { type, parameterIndex };
    Reflect.defineMetadata(ROUTE_METADATA_KEY, metadata, target, propertyKey);
    if (propertyKey === RequestMethod.Get)
      Reflect.defineMetadata(ROUTE_METADATA_KEY, metadata, target, RequestMethod.Head);
  }
}
export function FromQuery(key: string, type: PrimitiveType): (target: IResource, propertyKey: ResourceMethod, parameterIndex: number) => void {
  return function (target: IResource, propertyKey: ResourceMethod, parameterIndex: number) {
    const metadata: ParameterMetadata = Reflect.getMetadata(QUERY_METADATA_KEY, target, propertyKey) ?? {};
    metadata[key] = { type, parameterIndex };
    Reflect.defineMetadata(QUERY_METADATA_KEY, metadata, target, propertyKey);
    if (propertyKey === RequestMethod.Get)
      Reflect.defineMetadata(QUERY_METADATA_KEY, metadata, target, RequestMethod.Head);
  }
}
export function FromBody(type: z.ZodType): (target: IResource, propertyKey: Exclude<ResourceMethod, 'GET' | 'HEAD'>, parameterIndex: number) => void {
  return function (target: IResource, propertyKey: Exclude<ResourceMethod, 'GET' | 'HEAD'>, parameterIndex: number) {
    const metadata: ParameterMetadata<z.ZodType> = Reflect.getMetadata(BODY_METADATA_KEY, target, propertyKey) ?? {};
    metadata[parameterIndex] = { type, parameterIndex };
    Reflect.defineMetadata(BODY_METADATA_KEY, metadata, target, propertyKey);
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
