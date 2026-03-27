type Awaitable<T> = T | PromiseLike<T>;

type FetchParams = Parameters<typeof fetch>;
type FetchResult = ReturnType<typeof fetch>;

type FetchMiddleware =
  (init: RequestInit) =>
    Awaitable<((response: Response) => Response | Promise<Response>) | void>;

export class FetchBuilder {
  private readonly middlewares: FetchMiddleware[] = [];

  constructor(middlewares: FetchMiddleware[] = []) {
    this.middlewares = middlewares;
  }

  public with(mw: FetchMiddleware): FetchBuilder {
    return new FetchBuilder([...this.middlewares, mw]);
  }

  public build(): (...args: FetchParams) => FetchResult {
    return async (
      input: string | URL | globalThis.Request,
      init: RequestInit = {}
    ) => {
      // run request-side hooks, collect response handlers
      const responseHandlers = [];

      // run hooks in sequence
      for (const mw of this.middlewares) {
        const handler = await mw(init);
        if (handler)
          responseHandlers.push(handler);
      }

      const response = await fetch(input, init);

      // run hooks in sequence
      return responseHandlers.reduce(
        (p, task) => p.then(task),
        Promise.resolve(response)
      );
    };
  }
}