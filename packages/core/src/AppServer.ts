import type { MiddlewareHandler, ErrorHandler as HonoErrorHandler } from 'jsr:@hono/hono@4.6.14';
import { Hono } from 'jsr:@hono/hono@4.6.14';
import { Resource } from './Resource.ts';
import { ServiceMap } from "./ServiceMap.ts";
import { isResourceConstructor } from "./common/types.ts";
import { ErrorHandler, NotFoundHandler, ResponseTime } from "./middleware/index.ts";
import { AsyncEventTarget } from "./common/async-event-target.ts";
import { BeforeReady } from "./middleware/BeforeReady.ts";

interface AppServerEventMap {
  "ready": Event;
}

export class AppServer extends AsyncEventTarget<AppServerEventMap> {
  static #instance: AppServer;
  static #instanceId: string | null = null;
  readonly #services = new ServiceMap();

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

    // dispatch ready
    queueMicrotask(() => {
      this.dispatchEvent(
        new Event('ready', {
          cancelable: false,
          bubbles: false, 
          composed: false }
        )
      );
    });
  }

  public static get instance(): AppServer {
    if (!AppServer.#instance) {
      AppServer.#instanceId = crypto.randomUUID();
      AppServer.#instance = new AppServer(AppServer.#instanceId);
    }
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

  public registerErrorHandler(errorHandler: HonoErrorHandler) {
    this.app.onError(errorHandler);
  }

  public get app(): Hono {
    return Resource.app;
  }

  public get services(): ServiceMap {
    return this.#services;
  }
}
