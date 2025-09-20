import type { ExecutionContext, Hono, MiddlewareHandler } from 'hono';
import { Resource } from './Resource.ts';
import { type Service, ServiceMap } from './ServiceMap.ts';
import { type Constructor, isResourceConstructor } from './common/types.ts';
import { ErrorHandler, NotFoundHandler } from './middleware/index.ts';
import { FinishEvent, ReadyEvent, RequestEvent, type ResponseEvent } from './common/events.ts';
import { PromiseWrapper } from './common/promise-wrapper.ts';
import { TypedEventTarget } from './TypedEventTarget.ts';

export interface ApplicationEventMap {
  'ready': ReadyEvent;
  'finished': FinishEvent;
  'error': ErrorEvent;
  'request': RequestEvent;
  'response': ResponseEvent;
}

export type ApplicationState = 'idle' | 'running' | 'finished';

export class Application extends TypedEventTarget<ApplicationEventMap> {
  static #instance: Application;
  static readonly #brand = Symbol();
  readonly #services = new ServiceMap();
  readonly #readyPromise;
  readonly #finishedPromise;
  public readonly ready: Promise<void>;
  public readonly finished: Promise<void>;
  #state: ApplicationState = 'idle';

  private constructor(brand: symbol) {
    super();

    if (brand !== Application.#brand)
      throw new TypeError('Illegal constructor');

    this.#hono.onError(ErrorHandler);
    this.registerMiddlewares([
      NotFoundHandler,
    ]);

    this.#readyPromise = new PromiseWrapper<void>();
    this.#finishedPromise = new PromiseWrapper<void>();
    this.ready = this.#readyPromise.promise;
    this.finished = this.#finishedPromise.promise;
    queueMicrotask(() => {
      this.ready.then(() => this.#state = 'running');
      this.finished.then(() => this.#state = 'finished');
      const readyEvent = new ReadyEvent(() => {
        this.#readyPromise.resolve();
      });
      this.dispatchEvent(readyEvent);
    });
  }

  public static get instance(): Application {
    Application.#instance ??= new Application(Application.#brand);
    return Application.#instance;
  }

  public registerApp(path: string, app: Hono) {
    this.#hono.route(path, app);
  }

  public registerResources(resources: typeof Resource[]) {
    resources
      .forEach((MaybeResourceConstructor: unknown) => {
        if (isResourceConstructor(MaybeResourceConstructor))
          return new MaybeResourceConstructor();
        else
          throw new TypeError(`Expected Resource but received:\n${String(MaybeResourceConstructor)}`);
      });
  }

  public registerMiddlewares(middlewares: (MiddlewareHandler)[]) {
    middlewares.forEach((middleware) => this.#hono.use(middleware));
  }

  public registerService<T extends Service>(key: Constructor<T>, value: T): { registerService: Application['registerService'] } {
    this.#services.set(key, value);

    return { registerService: this.registerService.bind(this) };
  }

  public getService<T extends Service>(key: Constructor<T>): T {
    return this.#services.get(key);
  }

  public get state(): ApplicationState {
    return this.#state;
  }

  public fetch = async (request: Request, Env?: unknown, executionCtx?: ExecutionContext): Promise<Response> => {
    this.dispatchEvent(new RequestEvent(Env));
    await this.ready;
    return this.#hono.fetch(request, Env, executionCtx);
  };

  get #hono(): Hono {
    return Resource.hono;
  }

  public finish = (): void => {
    new Promise<void>((resolve) => {
      // await active request responses
      if (Resource.activeRequests) {
        const onResponse = (e: ResponseEvent) => {
          if (!e.context.var.activeRequests) {
            resolve();
            this.removeEventListener('response', onResponse);
          }
        };
        this.addEventListener('response', onResponse);
      }
      resolve();
    })
      .then(() => {
        // cleanup services
        return this.#services[Symbol.asyncDispose]();
      })
      .then(() => {
        this.#finishedPromise.resolve();
        this.dispatchEvent(new FinishEvent());
      });
  };
}
