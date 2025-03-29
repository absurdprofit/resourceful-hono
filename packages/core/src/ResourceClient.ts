import { mergePath } from 'hono/utils/url';
import { ACCEPT_METADATA_KEY, LAST_INDEX, PARAMETER_METADATA_KEY } from './common/constants.ts';
import { ContentTypes, Headers, HttpStatusCodes, RequestMethod } from './common/enums.ts';
import type { Constructor, ParameterMetadata, ResourceMethod, ServerSentEventGenerator, SimpleContentTypeRegistry } from './common/types.ts';
import type { Resource, TypedResultResponse, TypedRedirectResponse } from './Resource.ts';
import { z } from 'zod';
import { UnsupportedMediaTypeError } from './common/errors.ts';
import type { EventSource } from 'eventsource';
import { type ContentTypeHandler, ContentTypeRegistry } from './ContentTypeRegistry.ts';
import { HttpError } from './HttpError.ts';

type Redirect<M, S, D> = D extends typeof Resource
  ? S extends HttpStatusCodes.TemporaryRedirect | HttpStatusCodes.PermanentRedirect
    ? M extends keyof InstanceType<D>
      ? ReturnType<ResourceClientMethod<M, InstanceType<D>[M]>>
      : never
    : RequestMethod.Get extends keyof InstanceType<D>
      ? ReturnType<ResourceClientMethod<M, InstanceType<D>[RequestMethod.Get]>>
      : never
  : Promise<unknown>;
type Result<S, C, T> = T extends ContentTypes.ServerSentEvent
    ? Promise<EventSource>
    : C extends ServerSentEventGenerator
      ? Promise<EventSource>
      : C extends undefined
        ? Promise<void>
        : Promise<C>;

type ResourceClientMethod<HttpMethod, ResourceMethod> =
  ResourceMethod extends (...parameters: infer A) => infer R
    ? (...parameters: [...A, signal?: AbortSignal]) =>
      R extends TypedRedirectResponse<infer S, infer D> | Promise<TypedRedirectResponse<infer S, infer D>>
        ? Redirect<HttpMethod, S, D>
        : R extends TypedResultResponse<infer S, infer C, infer T> | Promise<TypedResultResponse<infer S, infer C, infer T>>
          ? Result<S, C, T>
          : Promise<R>
    : never;

export type ResourceClientInstance<R extends Resource> = {
  readonly methods: RequestMethod[];
  fetch: typeof globalThis.fetch;
} & {
  [
    K in ResourceMethod | Lowercase<ResourceMethod> as Uppercase<K> extends keyof R
      ? K
      : never
  ]: Uppercase<K> extends keyof R
      ? ResourceClientMethod<Uppercase<K>, R[Uppercase<K>]>
      : never;
}

type ResourceConstructor<T extends Resource> = (new () => T) & typeof Resource;

interface ResourceClientConstructor {
  contentTypes: SimpleContentTypeRegistry;
  fetch: typeof globalThis.fetch;
  new <R extends Resource>(resource: ResourceConstructor<R>, origin?: string): ResourceClientInstance<R>;
}

export const ResourceClient: ResourceClientConstructor = class <R extends Resource> {
  private static readonly contentTypeRegistry = ContentTypeRegistry.default;
  private readonly contentTypeRegistry = new ContentTypeRegistry();
  public static readonly contentTypes: SimpleContentTypeRegistry = {
    use: (pattern: string | string[], handler: ContentTypeHandler) => {
      return this.contentTypeRegistry.use('*', pattern, handler);
    },
    get: (contentType: string) => {
      return this.contentTypeRegistry.get('*', contentType);
    },
  };
  public readonly methods;
  readonly #parameterMetadata;
  readonly #routeSchema;
  readonly #acceptMetadata;
  readonly #resource;
  public readonly origin: string;
  public static fetch = globalThis.fetch?.bind(globalThis);
  public fetch: ResourceClientConstructor['fetch'];

  constructor(
    resource: ResourceConstructor<R>,
    origin?: string
  ) {
    this.fetch = ResourceClient.fetch;
    if (globalThis.location instanceof Location)
      origin ??= globalThis.location.origin;
    else if (typeof origin !== 'string')
      throw new TypeError('origin is undefined.');

    this.#resource = resource;
    this.methods = resource.methods;
    this.#parameterMetadata = this.#collectParameterMetadata();
    this.#routeSchema = this.#collectParameterSchema<z.AnyZodObject>('route');
    this.#acceptMetadata = this.#collectMethodMetadata<ContentTypes[]>(ACCEPT_METADATA_KEY);
    this.origin = origin;

    this.#acceptMetadata.entries().forEach(([method, contentTypes]) => {
      contentTypes ??= [ContentTypes.Json];
      contentTypes.forEach((contentType) => {
        const handler = ResourceClient.contentTypes.get(contentType);
        if (!handler) return;
        this.contentTypeRegistry.use(method, contentType, handler);
      });
    });

    Object.defineProperties(
      this,
      this.methods.reduce(
        (properties, method) => {
          properties[method] = {
            value: {
              [method]: async (...parameters: unknown[]) => {
                return await this.#METHOD(method, ...parameters);
              },
            }[method],
            enumerable: true,
          };
          properties[method.toLowerCase() as Lowercase<ResourceMethod>] = {
            value: {
              [method.toLowerCase()]: async (...parameters: unknown[]) => {
                return await this.#METHOD(method, ...parameters);
              },
            }[method.toLowerCase()],
          };
          return properties;
        },
        {} as { [K in ResourceMethod | Lowercase<ResourceMethod>]: PropertyDescriptor }
      )
    );
  }

  public get [Symbol.toStringTag](): string {
    return `${this.#resource.name}Client`;
  }

  async #METHOD(method: RequestMethod, ...parameters: unknown[]) {
    const {
      pathname,
      search,
      body,
      headers,
    } = await this.#serialiseParameters(method, parameters);
    const signal = parameters.at(LAST_INDEX) instanceof AbortSignal
      ? parameters.at(LAST_INDEX) as AbortSignal
      : undefined;

    const url = new URL(pathname, this.origin);
    url.search = search;

    const response = await this.fetch(url, { signal, method, body, headers });
    const responseContentType = response.headers.get(Headers.ContentType);
    
    if (!responseContentType?.length || response.status === HttpStatusCodes.NoContent) return;
    const handler = ResourceClient.contentTypes.get(responseContentType);
    if (handler?.decode) {
      const result = await handler.decode(response);
      if (result instanceof HttpError)
        throw result;
      return result;
    }
    response.body?.cancel();
    throw new UnsupportedMediaTypeError(`Could not find a decoder for ${this.#resource.name}.${method}`);
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

  async #serialiseParameters(method: RequestMethod, parameters: unknown[]) {
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
            [metadata.key]: parameters[index],
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
    
    const acceptedContentTypes = this.#acceptMetadata.get(method) ?? [ContentTypes.Json];
    let matchedContentType = undefined;
    let matchedEncoder = undefined;
    for (const contentType of acceptedContentTypes) {
      const handler = this.contentTypeRegistry.get(method, contentType);
      if (handler?.encode) {
        matchedContentType = contentType;
        matchedEncoder = handler.encode;
        break;
      }
    }
    const headers = new globalThis.Headers();
    if (!matchedEncoder)
      throw new UnsupportedMediaTypeError(`Could not find an encoder for ${this.#resource.name}.${method}`);
    if (
      matchedContentType !== ContentTypes.MultipartFormData
      && matchedContentType
    )
      headers.set(Headers.ContentType, matchedContentType);
    return {
      headers,
      search: new URLSearchParams((data?.query ?? {}) as Record<string, string>).toString(),
      pathname: this.#serialiseRoute(data?.route, method),
      body: await this.#serialiseBody(data?.body, method, matchedContentType, matchedEncoder),
    };
  }

  #serialiseRoute(route: z.infer<z.ZodType>, method: RequestMethod) {
    if (typeof route === 'object') {
      // order matters for route params
      const routeSchema = this.#routeSchema.get(method)!;
      route = Object.fromEntries(
        Object.keys(routeSchema.shape)
          .reverse()
          .filter(key => key in route)
          .map(key => [key, route[key]])
      );
    } else {
      route = {};
    }

    return mergePath(
      this.#resource.pathname,
      ...Object.values<string>(route)
    );
  }

  #serialiseBody(
    body: z.infer<z.ZodType>,
    method: RequestMethod,
    contentType: string | undefined,
    encode: ContentTypeHandler['encode']
  ) {
    if (![RequestMethod.Get, RequestMethod.Head].includes(method)) {
      return encode(body, contentType);
    }
  }
} as unknown as ResourceClientConstructor;