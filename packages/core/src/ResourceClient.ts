import { mergePath } from "hono/utils/url";
import { ACCEPT_METADATA_KEY, PARAMETER_METADATA_KEY } from "./common/constants.ts";
import { ContentTypes, Headers, HttpStatusCodes, type RequestMethod } from "./common/enums.ts";
import type { ParameterMetadata, ResourceMethod, ServerSentEventGenerator } from "./common/types.ts";
import type { Resource, TypedResultResponse, TypedRedirectResponse } from "./Resource.ts";
import { z } from 'zod';
import { GenericHttpError, UnsupportedMediaTypeError } from "./common/errors.ts";
import { EventSource } from 'eventsource';

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
  readonly methods: RequestMethod[];
  readonly #parameterMetadata;
  readonly #routeSchema;
  readonly #acceptMetadata;
  readonly #resource;
  readonly #origin;
  readonly #contentTypes = Object.values(ContentTypes);

  constructor(resource: R, origin: string) {
    this.#resource = resource;
    this.methods = resource.methods;
    this.#parameterMetadata = this.#collectParameterMetadata();
    this.#routeSchema = this.#collectParameterSchema<z.AnyZodObject>('route');
    this.#acceptMetadata = this.#collectMethodMetadata<ContentTypes[]>(ACCEPT_METADATA_KEY);
    this.#origin = origin;

    Object.defineProperties(
      this,
      this.methods.reduce(
        (properties, method) => {
          properties[method] = {
            value: {
              [method]: async (...parameters: unknown[]) => {
                return await this.#METHOD(method, ...parameters);
              }
            }[method],
            enumerable: true,
          };
          properties[method.toLowerCase() as Lowercase<ResourceMethod>] = {
            value: {
              [method.toLowerCase()]: async (...parameters: unknown[]) => {
                return await this.#METHOD(method, ...parameters);
              }
            }[method.toLowerCase()],
            enumerable: true,
          };
          return properties;
        },
        {} as { [K in ResourceMethod | Lowercase<ResourceMethod>]: PropertyDescriptor }
      ),
    );
  }

  get [Symbol.toStringTag](): string {
    return `${this.#resource.name}Client`;
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

  #serialiseParameters(method: RequestMethod, contentType: string, parameters: unknown[]) {
    const data = this.#parameterMetadata.get(method)?.reduce((
      data: Record<ParameterMetadata['type'], z.infer<z.ZodType> | undefined>,
      metadata,
      index
    ) => {
      if (metadata.key) {
        if (data[metadata.type]) {
          data[metadata.type][metadata.key] = parameters[index];
        } else {
          data[metadata.type] = {
            [metadata.key]: parameters[index]
          };
        }
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
      } else {
        data[metadata.type] = parameters[index];
      }

      return data;
    }, { route: undefined, query: undefined, body: undefined });
    
    if (data?.route && typeof data.route === 'object') {
      // order matters for route params
      const routeSchema = this.#routeSchema.get(method)!;
      data.route = Object.fromEntries(
        Object.keys(routeSchema.shape)
          .reverse()
          .filter(key => key in data.route)
          .map(key => [key, data.route[key]])
      );
    }

    const pathname = data?.route && typeof data.route === 'object'
      ? mergePath(
          this.#resource.pathname,
          ...Object.values<string>(data?.route ?? {})
        )
      : mergePath(this.#resource.pathname, data?.route ?? "");
    return {
      search: new URLSearchParams((data?.query ?? {}) as Record<string, string>).toString(),
      pathname,
      body: this.#serialiseBody(data?.body, contentType),
    }
  }

  #serialiseBody(body: z.infer<z.ZodType>, contentType: string) {
    if (body) {
      switch (contentType) {
        case ContentTypes.FormUrlEncoded:
        case ContentTypes.MultipartFormData:
          if (typeof body === 'object' && body !== null) {
            const formData = new FormData();
            for (const key of body)
              formData.append(key, body[key]);
            body = formData;
          } else {
            // This is sus. Should we instead select JSON if that's available?
            throw new TypeError('Body must be object type for FormData');
          }
        break;
        case ContentTypes.Json:
          body = JSON.stringify(body);
        break;
      }
    }
    return body;
  }
}