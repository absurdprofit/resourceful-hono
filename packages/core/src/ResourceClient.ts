import { mergePath } from "jsr:@hono/hono@4.6.14/utils/url";
import { ACCEPT_METADATA_KEY, PARAMETER_METADATA_KEY } from "./common/constants.ts";
import { ContentTypes, Headers, HttpStatusCodes, type RequestMethod } from "./common/enums.ts";
import type { ParameterMetadata, ResourceMethod, ServerSentEventGenerator } from "./common/types.ts";
import type { Resource, TypedResultResponse, TypedRedirectResponse } from "./Resource.ts";
import type { z } from 'npm:zod@3.24.1';
import { GenericHttpError, UnsupportedMediaTypeError } from "./common/errors.ts";
import { EventSource } from 'npm:eventsource@3.0.2';

type Redirect<M, S, D> = D extends typeof Resource
  ? S extends HttpStatusCodes.TemporaryRedirect | HttpStatusCodes.PermanentRedirect
    ? M extends keyof InstanceType<D>
      ? ReturnType<IResourceClientMethod<M, InstanceType<D>[M]>>
      : never
    : RequestMethod.Get extends keyof InstanceType<D>
      ? ReturnType<IResourceClientMethod<M, InstanceType<D>[RequestMethod.Get]>>
      : never
  : Promise<unknown>;
type Result<C, T> = T extends ContentTypes.ServerSentEvent
    ? Promise<EventSource>
    : C extends ServerSentEventGenerator
      ? Promise<EventSource>
      : C extends undefined
        ? Promise<void>
        : Promise<C>;

type IResourceClientMethod<HttpMethod, ResourceMethod> =
  ResourceMethod extends (...parameters: infer A) => infer R
    ? (...parameters: [...A, signal?: AbortSignal]) =>
      R extends TypedRedirectResponse<infer S, infer D> | Promise<TypedRedirectResponse<infer S, infer D>>
        ? Redirect<HttpMethod, S, D>
        : R extends TypedResultResponse<infer C, infer T> | Promise<TypedResultResponse<infer C, infer T>>
          ? Result<C, T>
          : Promise<R>
    : never;

export type IResourceClient<R extends typeof Resource> = {
  [
    K in ResourceMethod | Lowercase<ResourceMethod> as Uppercase<K> extends keyof InstanceType<R>
      ? K
      : never
  ]: Uppercase<K> extends keyof InstanceType<R>
      ? IResourceClientMethod<Uppercase<K>, InstanceType<R>[Uppercase<K>]>
      : never;
}

export class ResourceClient<R extends typeof Resource> {
  readonly methods;
  readonly #parameterMetadata;
  readonly #acceptMetadata;
  readonly #resource;
  readonly #origin;
  readonly #contentTypes = Object.values(ContentTypes);

  constructor(resource: R, origin: string) {
    this.#resource = resource;
    this.methods = resource.methods;
    this.#parameterMetadata = this.#collectParameterMetadata();
    this.#acceptMetadata = this.#collectMethodMetadata<ContentTypes[]>(ACCEPT_METADATA_KEY);
    this.#origin = origin;

    Object.defineProperties(
      this,
      this.methods.reduce(
        (properties, method) => {
          properties[method] = {
            value: (...parameters: unknown[]) => this.#METHOD(method, ...parameters),
          };
          properties[method.toLowerCase() as Lowercase<ResourceMethod>] = {
            value: (...parameters: unknown[]) => this.#METHOD(method, ...parameters),
          };
          return properties;
        },
        {} as { [K in ResourceMethod | Lowercase<ResourceMethod>]: PropertyDescriptor }
      ),
    );
  }

  async #METHOD(method: RequestMethod, ...parameters: unknown[]) {
    const [requestContentType] = this.#acceptMetadata.get(method) ?? [ContentTypes.Json];
    const { pathname, search, body } = this.#serialiseParameters(method, requestContentType, parameters);
    const signal = parameters.at(-1) instanceof AbortSignal ? parameters.at(-1) as AbortSignal : undefined;

    const url = new URL(pathname, this.#origin);
    url.search = search;

    const headers = new globalThis.Headers({ [Headers.ContentType]: requestContentType });
    const response = await fetch(url, { signal, method, body, headers });
    const responseContentType = response.headers.get(Headers.ContentType) ?? "";
    
    if (!responseContentType.length || response.status === HttpStatusCodes.NoContent) return;
    switch (this.#contentTypes.find(accepted => responseContentType.startsWith(accepted))) {
      case ContentTypes.ProblemDetails:
        throw new GenericHttpError(await response.json());
      case ContentTypes.ServerSentEvent:
        return new EventSource(url, { fetch: () => Promise.resolve(response) });
      case ContentTypes.Json:
        return await response.json();
      default:
        throw new UnsupportedMediaTypeError(`The server returned an unsupported content type: '${responseContentType}'`);
    }
  }

  #collectMethodMetadata<T>(key: symbol) {
    return this.methods.reduce((metadata, method) => {
      return metadata.set(method, Reflect.getMetadata(key, this.#resource, method));
    }, new Map<RequestMethod, T>());
  }

  #collectParameterMetadata() {
    return this.methods.reduce((metadata, method) => {
      return metadata.set(method, Reflect.getMetadata(PARAMETER_METADATA_KEY, this.#resource, method) ?? []);
    }, new Map<RequestMethod, ParameterMetadata[]>());
  }

  #serialiseParameters(method: RequestMethod, contentType: string, parameters: unknown[]) {
    const data = this.#parameterMetadata.get(method)?.reduce((
      data: Record<ParameterMetadata['type'], z.infer<z.ZodType> | undefined>,
      metadata,
      index
    ) => {
      if (data[metadata.type]) {
        if (metadata.key) {
          data[metadata.type][metadata.key] = parameters[index];
        } else if (
          typeof data[metadata.type] === 'object'
          && data[metadata.type] !== null
          && typeof parameters[index] === 'object'
          && parameters[index] !== null
        ) {
            data[metadata.type] = {
              ...data[metadata.type],
              ...parameters[index],
            };
        }
        return data;
      } else {
        data[metadata.type] = parameters[index];
      }
      
      return data;
    }, { route: undefined, query: undefined, body: undefined });
    
    let body = undefined;
    if (data?.body) {
      switch (contentType) {
        case ContentTypes.Json:
          body = JSON.stringify(data.body);
        break;
      }
    }
    return {
      pathname: mergePath(this.#resource.pathname, ...Object.values<string>(data?.route ?? {})),
      search: new URLSearchParams((data?.query ?? {}) as Record<string, string>).toString(),
      body,
    }
  }
}