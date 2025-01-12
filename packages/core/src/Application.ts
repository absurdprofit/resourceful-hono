import type { MiddlewareHandler, ErrorHandler as HonoErrorHandler } from 'jsr:@hono/hono@4.6.14';
import { Hono } from 'jsr:@hono/hono@4.6.14';
import { Resource } from './Resource.ts';
import { type Service, ServiceMap } from "./ServiceMap.ts";
import { type Constructor, isResourceConstructor } from "./common/types.ts";
import { ErrorHandler, NotFoundHandler, ResponseTime } from "./middleware/index.ts";
import { BeforeReady } from "./middleware/BeforeReady.ts";
import { FinishEvent, ReadyEvent } from "./common/events.ts";
import { PromiseWrapper } from "./common/promise-wrapper.ts";
import { TypedEventTarget } from "./TypedEventTarget.ts";

interface ApplicationEventMap {
  "ready": ReadyEvent;
  "finished": FinishEvent;
}

export class Application extends TypedEventTarget<ApplicationEventMap> {
  static #instance: Application;
  static readonly #instanceId = crypto.randomUUID();
  readonly #services = new ServiceMap();
  readonly #readyPromise;
  readonly #finishedPromise;
  readonly ready;
  readonly finished;

  private constructor(instanceId: string) {
    super();

    if (instanceId !== Application.#instanceId)
      throw new TypeError('Illegal constructor');

    this.registerMiddlewares([
      BeforeReady,
      ResponseTime,
    ]);
    this.#hono.notFound(NotFoundHandler);
    this.registerErrorHandler(ErrorHandler);

    this.#readyPromise = new PromiseWrapper();
    this.#finishedPromise = new PromiseWrapper<void>();
    this.ready = this.#readyPromise.promise;
    this.finished = this.#finishedPromise.promise;
    queueMicrotask(() => {
      const readyEvent = new ReadyEvent(this.#readyPromise.resolve);
      this.dispatchEvent(readyEvent);
    });
  }

  public static get instance(): Application {
    Application.#instance ??= new Application(Application.#instanceId);
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
          throw new Error(`Expected Resource but received:\n${MaybeResourceConstructor}`);
      });
  }

  public registerMiddlewares(middlewares: (MiddlewareHandler)[]) {
    middlewares.forEach((middleware) => this.#hono.use(middleware));
  }

  public registerService<T extends Service>(key: Constructor<T>, value: T) {
    this.#services.set(key, value);
  }

  public registerErrorHandler(errorHandler: HonoErrorHandler) {
    this.#hono.onError(errorHandler);
  }

  public getService<T extends Service>(key: Constructor<T>) {
    return this.#services.get(key);
  }

  public get fetch() {
    return this.#hono.fetch;
  }

  get #hono(): Hono {
    return Resource.hono;
  }

  public finish = () => {
    this.#services[Symbol.asyncDispose]()
      .then(() => {
        this.#finishedPromise.resolve();
        this.dispatchEvent(new FinishEvent());
      });
  }
}
