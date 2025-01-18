import { mergePath } from "jsr:@hono/hono@4.6.14/utils/url";
import { ACCEPT_METADATA_KEY, BODY_METADATA_KEY, QUERY_METADATA_KEY, ROUTE_METADATA_KEY } from "./common/constants.ts";
import { type ContentTypes, RequestMethod } from "./common/enums.ts";
import type { ParameterMetadata, ResourceMethod } from "./common/types.ts";
import type { Resource, TypedResponse } from "./Resource.ts";
import type { z } from 'npm:zod@3.24.1';
import { BadRequestError } from "./common/errors.ts";

export type IResourceClientMethod<M> = M extends (...args: infer A) => infer R ? (...args: A) => R extends TypedResponse<infer C> ? Promise<C> : R : never;

export type IResourceClient<R extends typeof Resource> = {
  [K in ResourceMethod | Lowercase<ResourceMethod> as Uppercase<K> extends keyof InstanceType<R> ? K : never]: Uppercase<K> extends keyof InstanceType<R> ? IResourceClientMethod<InstanceType<R>[Uppercase<K>]> : never;
}

export class ResourceClient<R extends typeof Resource> {
  readonly #methods: RequestMethod[] = Object.values(RequestMethod);
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

    Object.defineProperties(
      this,
      this.#methods.reduce(
        (properties, method) => {
          properties[method] = {
            value: (...args: unknown[]) => this.#METHOD(method, ...args),
          };
          properties[method.toLowerCase() as Lowercase<ResourceMethod>] = {
            value: (...args: unknown[]) => this.#METHOD(method, ...args),
          };
          return properties;
        },
        {} as { [K in ResourceMethod | Lowercase<ResourceMethod>]: PropertyDescriptor }
      ),
    );
  }

  async #METHOD(method: RequestMethod, ...args: unknown[]) {
    const issues: z.ZodIssue[] = [];
    const pathname = this.serialiseRouteParams(method, args, issues);
    const search = this.serialiseQueryParams(method, args, issues);
 
    if (issues.length)
      throw new BadRequestError('There were issues in your request.', { issues });

    const url = new URL(pathname, 'http://localhost:8000');
    url.search = search

    const json = await fetch(url).then(res => res.json());
    return json;
  }

  private collectParameterMetadata<T>(key: symbol) {
    return this.#methods.reduce((metadata, method) => {
      return metadata.set(method, Reflect.getMetadata(key, this.#resource, method) ?? {});
    }, new Map<RequestMethod, T>());
  }

  private serialiseRouteParams(method: RequestMethod, args: unknown[], issues: z.ZodIssue[]) {
    const paramMetadata: ParameterMetadata = this.#routeMetadata.get(method) ?? {};
    const routeParams = new Array<string>();
    for (const [_, metadata] of Object.entries(paramMetadata).toReversed()) {
      const value = args[metadata.parameterIndex];

      const parseResult = metadata.type.safeParse(value);
      if (parseResult.error) {
        issues.push(...parseResult.error.issues.map(issue => {
          issue.path.push(`arg[${metadata.parameterIndex}]`);
          return issue;
        }));
      } else if (parseResult.data !== undefined && parseResult.data !== null) {
        routeParams.push(parseResult.data);
      }
    }
    return mergePath(this.#resource.pathname, ...routeParams);
  }

  private serialiseQueryParams(
    method: RequestMethod,
    args: unknown[],
    issues: z.ZodIssue[] // To collect validation issues
  ): string {
    const paramMetadata: ParameterMetadata = this.#queryMetadata.get(method) ?? {};
    const searchParams = new URLSearchParams();
  
    for (const [param, metadata] of Object.entries(paramMetadata)) {
      const value = args[metadata.parameterIndex];
  
      const parseResult = metadata.type.safeParse(value);
      if (parseResult.error) {
        issues.push(
          ...parseResult.error.issues.map((issue) => {
            issue.path.push(`arg[${metadata.parameterIndex}]`);
            return issue;
          })
        );
      } else if (parseResult.data !== undefined && parseResult.data !== null) {
        // Add valid values to search parameters
        searchParams.append(param, String(parseResult.data));
      }
    }
  
    return searchParams.toString();
  }
}