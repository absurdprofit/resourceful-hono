import { mergePath } from "hono/utils/url";
import { ACCEPT_METADATA_KEY, PARAMETER_METADATA_KEY } from "./common/constants.ts";
import { ContentTypes, Headers, HttpStatusCodes, RequestMethod } from "./common/enums.ts";
import type { ParameterMetadata, ResourceMethod, ServerSentEventGenerator } from "./common/types.ts";
import type { Resource, TypedResultResponse, TypedRedirectResponse } from "./Resource.ts";
import { z } from 'zod';
import { UnsupportedMediaTypeError } from "./common/errors.ts";
import type { EventSource } from 'eventsource';
import { type ContentTypeHandler, ContentTypeRouter } from "./ContentTypeRouter.ts";
import { createGlobalContentTypeRouter } from "./common/utils.ts";

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
  static readonly #contentTypeRouter = createGlobalContentTypeRouter();
  private readonly contentTypeRouter = new ContentTypeRouter();
  readonly methods: RequestMethod[];
  readonly #parameterMetadata;
  readonly #routeSchema;
  readonly #acceptMetadata;
  readonly #resource;
  readonly #origin;

  constructor(resource: R, origin: string) {
    this.#resource = resource;
    this.methods = resource.methods;
    this.#parameterMetadata = this.#collectParameterMetadata();
    this.#routeSchema = this.#collectParameterSchema<z.AnyZodObject>('route');
    this.#acceptMetadata = this.#collectMethodMetadata<ContentTypes[]>(ACCEPT_METADATA_KEY);
    this.#origin = origin;

    this.#acceptMetadata.entries().forEach(([method, contentTypes]) => {
      contentTypes ??= [ContentTypes.Json];
      contentTypes.forEach((contentType) => {
        const handler = ResourceClient.contentTypes.get(contentType);
        if (handler)
          this.contentTypeRouter.use(method, contentType, handler);
        else
          throw new ReferenceError(`A handler hasn't been registered for ${contentType}`);
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

  public static get contentTypes() {
    return {
      use: (pattern: string | string[], handler: ContentTypeHandler) => {
        return this.#contentTypeRouter.use('*', pattern, handler)
      },
      get: (contentType: string) => {
        return this.#contentTypeRouter.get('*', contentType);
      }
    }
  }

  get [Symbol.toStringTag](): string {
    return `${this.#resource.name}Client`;
  }

  async #METHOD(method: RequestMethod, ...parameters: unknown[]) {
    const [requestContentType] = this.#acceptMetadata.get(method) ?? [ContentTypes.Json];
    const { pathname, search, body } = await this.#serialiseParameters(method, requestContentType, parameters);
    const signal = parameters.at(-1) instanceof AbortSignal ? parameters.at(-1) as AbortSignal : undefined;

    const url = new URL(pathname, this.#origin);
    url.search = search;

    const headers = new globalThis.Headers();
    if (!FormData[Symbol.hasInstance](body))
      headers.set(Headers.ContentType, requestContentType);
    const response = await fetch(url, { signal, method, body, headers });
    const responseContentType = response.headers.get(Headers.ContentType) ?? "";
    
    if (!responseContentType.length || response.status === HttpStatusCodes.NoContent) return;
    const handler = this.contentTypeRouter.get(method, responseContentType);
    if (handler)
      return handler.decode(response);
    throw new UnsupportedMediaTypeError(`Content type '${responseContentType}' is unsupported`);
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

  async #serialiseParameters(method: RequestMethod, contentType: string, parameters: unknown[]) {
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
      body: await this.#serialiseBody(data?.body, method, contentType),
    }
  }

  #serialiseBody(body: z.infer<z.ZodType>, method: RequestMethod, contentType: string) {
    if (![RequestMethod.Get, RequestMethod.Head].includes(method)) {
      const handler = this.contentTypeRouter.get(method, contentType);
      return handler?.encode(body);
    }
  }
}