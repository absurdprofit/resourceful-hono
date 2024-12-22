import type { MiddlewareHandler, ErrorHandler } from 'jsr:@hono/hono@4.6.14';
import { Hono } from 'jsr:@hono/hono@4.6.14';
import { Resource } from './Resource.ts';
import { importGlob } from "./common/utils.ts";
import { ServiceMap } from "./ServiceMap.ts";
import { isResourceConstructor } from "./common/types.ts";

export class AppServer {
  static #instance: AppServer;
  static #instanceId: string | null = null;
  readonly #services = new ServiceMap();

  private constructor(instanceId: string) {
    if (instanceId !== AppServer.#instanceId)
      throw new TypeError('Illegal constructor');
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

  public async registerResources(glob: string) {
    const resources = await importGlob(glob);
    resources
      .map(module => module.default)
      .forEach((MaybeResourceConstructor: unknown) => {
        if (isResourceConstructor(MaybeResourceConstructor))
          return new MaybeResourceConstructor();
        else
          throw new Error(`Expected Resource but received:\n${MaybeResourceConstructor}`);
      });
  }

  public registerMiddleware(middlewares: (MiddlewareHandler)[]) {
    middlewares.forEach((middleware) => this.app.use(middleware));
  }

  public registerErrorHandler(errorHandler: ErrorHandler) {
    this.app.onError(errorHandler);
  }

  public get app(): Hono {
    return Resource.app;
  }

  public get services(): ServiceMap {
    return this.#services;
  }
}
