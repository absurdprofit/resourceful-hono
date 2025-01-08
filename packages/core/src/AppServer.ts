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

interface AppServerEventMap {
  "ready": ReadyEvent;
  "finished": FinishEvent;
}

export class AppServer extends TypedEventTarget<AppServerEventMap> {
  static #instance: AppServer;
  static readonly #instanceId = crypto.randomUUID();
  readonly #services = new ServiceMap();
  readonly #readyPromise;
  readonly #finishedPromise;
  readonly ready;
  readonly finished;

  private constructor(instanceId: string) {
    super();

    if (instanceId !== AppServer.#instanceId)
      throw new TypeError('Illegal constructor');

    this.registerMiddlewares([
      BeforeReady,
      ResponseTime,
    ]);
    this.app.notFound(NotFoundHandler);
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

  public static get instance(): AppServer {
    AppServer.#instance ??= new AppServer(AppServer.#instanceId);
    return AppServer.#instance;
  }

  public registerApp(path: string, app: Hono) {
    this.app.route(path, app);
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
    middlewares.forEach((middleware) => this.app.use(middleware));
  }

  public registerService<T extends Service>(key: Constructor<T>, value: T) {
    this.#services.set(key, value);
  }

  public registerErrorHandler(errorHandler: HonoErrorHandler) {
    this.app.onError(errorHandler);
  }

  public getService<T extends Service>(key: Constructor<T>) {
    return this.#services.get(key);
  }

  public get app(): Hono {
    return Resource.app;
  }

  public finish = () => {
    this.#services[Symbol.asyncDispose]()
      .then(() => {
        this.#finishedPromise.resolve();
        this.dispatchEvent(new FinishEvent());
      });
  }
}
