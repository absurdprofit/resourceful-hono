import { ACCEPT_METADATA_KEY, BODY_METADATA_KEY, QUERY_METADATA_KEY, ROUTE_METADATA_KEY } from "./common/constants.ts";
import { type ContentTypes, RequestMethod } from "./common/enums.ts";
import { ParameterMetadata, ResourceMethod } from "./common/types.ts";
import { Resource, TypedResponse } from "./Resource.ts";

export type IResourceClientMethod<M> = M extends (...args: infer A) => infer R ? (...args: A) => R extends TypedResponse<infer C> ? C : R : never;

export type IResourceClient<R extends Resource> = {
  [K in ResourceMethod as K extends keyof R ? K : never]: K extends keyof R ? IResourceClientMethod<R[K]> : never;
}

export class ResourceClient<R extends typeof Resource> {
  readonly #routeMetadata;
  readonly #queryMetadata;
  readonly #bodyMetadata;
  readonly #acceptMetadata;
  readonly #resource;

  constructor(resource: R) {
    this.#resource = resource;
    this.#routeMetadata = this.collectParameterMetadata<ParameterMetadata>(ROUTE_METADATA_KEY);
    this.#queryMetadata = this.collectParameterMetadata<ParameterMetadata>(QUERY_METADATA_KEY);
    this.#bodyMetadata = this.collectParameterMetadata<ParameterMetadata>(BODY_METADATA_KEY);
    this.#acceptMetadata = this.collectParameterMetadata<ContentTypes[]>(ACCEPT_METADATA_KEY);
  }

  private collectParameterMetadata<T>(key: symbol) {
    return Object.values(RequestMethod).reduce((metadata, method) => {
      return metadata.set(method, Reflect.getMetadata(key, this.#resource, method) ?? {});
    }, new Map<RequestMethod, T>());
  }
}