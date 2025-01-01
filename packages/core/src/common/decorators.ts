import { BODY_METADATA_KEY, PATH_METADATA_KEY, QUERY_METADATA_KEY, ACCEPT_METADATA_KEY, ROUTE_METADATA_KEY } from './constants.ts';
import type { z } from 'npm:zod@3.24.1';
import { type ContentTypes, RequestMethod } from "./enums.ts";
import type { IResource, ResourceLikeConstructor, ResourceMethods } from "../Resource.ts";
import type { Constructor, ParameterMetadata, PrimitiveType } from "./types.ts";
import { AppServer } from "../AppServer.ts";

export function Accept(acceptedContentTypes: ContentTypes[]): (target: IResource, propertyKey: string) => void {
  function AcceptFactory(target: IResource, propertyKey: string) {
    Reflect.defineMetadata(ACCEPT_METADATA_KEY, acceptedContentTypes, target, propertyKey);
  }
  return AcceptFactory;
}
export function Route(path: string): <T extends ResourceLikeConstructor>(target: T) => void {
  if (path.includes(':'))
    throw new Error('Your route includes a path param which must be a mistake. Path params are already inferred.');
  function RouteFactory<T extends ResourceLikeConstructor>(target: T) {
    return Reflect.defineMetadata(`${target.name}${ROUTE_METADATA_KEY}`, path, target);
  }
  return RouteFactory;
}
export function FromRoute(key: string, type: PrimitiveType): (target: IResource, propertyKey: ResourceMethods, parameterIndex: number) => void {
  function FromRouteFactory(target: IResource, propertyKey: ResourceMethods, parameterIndex: number) {
    const metadata: ParameterMetadata = Reflect.getMetadata(PATH_METADATA_KEY, target, propertyKey) ?? {};
    metadata[key] = { type, parameterIndex };
    Reflect.defineMetadata(PATH_METADATA_KEY, metadata, target, propertyKey);
    if (propertyKey === RequestMethod.Get)
      Reflect.defineMetadata(PATH_METADATA_KEY, metadata, target, RequestMethod.Head);
  }
  return FromRouteFactory;
}
export function FromQuery(key: string, type: PrimitiveType): (target: IResource, propertyKey: ResourceMethods, parameterIndex: number) => void {
  function FromQueryFactory(target: IResource, propertyKey: ResourceMethods, parameterIndex: number) {
    const metadata: ParameterMetadata = Reflect.getMetadata(QUERY_METADATA_KEY, target, propertyKey) ?? {};
    metadata[key] = { type, parameterIndex };
    Reflect.defineMetadata(QUERY_METADATA_KEY, metadata, target, propertyKey);
    if (propertyKey === RequestMethod.Get)
      Reflect.defineMetadata(PATH_METADATA_KEY, metadata, target, RequestMethod.Head);
  }
  return FromQueryFactory;
}
export function FromBody(type: z.ZodType): (target: IResource, propertyKey: Exclude<ResourceMethods, 'GET' | 'HEAD'>, parameterIndex: number) => void {
  function FromBodyFactory(target: IResource, propertyKey: Exclude<ResourceMethods, 'GET' | 'HEAD'>, parameterIndex: number) {
    const metadata: ParameterMetadata<z.ZodType> = Reflect.getMetadata(BODY_METADATA_KEY, target, propertyKey) ?? {};
    metadata[parameterIndex] = { type, parameterIndex };
    Reflect.defineMetadata(BODY_METADATA_KEY, metadata, target, propertyKey);
  }
  return FromBodyFactory;
}

export function Inject(type?: Constructor<unknown>): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol) {
    type = type ?? Reflect.getMetadata('design:type', target, propertyKey);
    Object.defineProperty(target, propertyKey, {
      get: () => {
        if (!type) throw new Error(`Could not determine type for property ${propertyKey.toString()}`);
        return AppServer.instance.services.get(type);
      },
    });
  };
}
