export abstract class CacheService implements Cache {
  public abstract add(request: RequestInfo | URL): Promise<void>;
  public abstract addAll(requests: unknown): Promise<void>;
  public abstract delete(request: unknown, options?: unknown): Promise<boolean>;
  public abstract keys(request?: RequestInfo | URL, options?: CacheQueryOptions): Promise<ReadonlyArray<Request>>;
  public abstract match(request: unknown, options?: unknown): Promise<Response | undefined>;
  public abstract matchAll(request?: RequestInfo | URL, options?: CacheQueryOptions): Promise<ReadonlyArray<Response>>;
  public abstract put(request: unknown, response: unknown): Promise<void>;
}