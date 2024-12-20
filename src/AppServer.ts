import type { MiddlewareHandler, ErrorHandler } from 'jsr:@hono/hono@4.6.14';
import { Hono } from 'jsr:@hono/hono@4.6.14';
import { Resource, type NonAbstractResourceLikeConstructor } from './Resource.ts';
import { importGlob } from "./common/utils.ts";
import { ServiceMap } from "./ServiceMap.ts";

export class AppServer {
  static #app: Hono;
  static #instance: AppServer;
  static #instanceId: string | null = null;
  readonly #services = new ServiceMap();

  private constructor(instanceId: string) {
    if (instanceId !== AppServer.#instanceId)
      throw new TypeError('Illegal constructor');
    AppServer.#instanceId = instanceId;
    AppServer.#app = Resource.app;
    this.#services.set(Hono, AppServer.#app);
  }

  public static get instance(): AppServer {
    if (!AppServer.#instance) {
      AppServer.#instance = new AppServer(crypto.randomUUID());
    }
    return AppServer.#instance;
  }

  public registerApp(path: string, app: Hono) {
    this.app.route(path, app);
  }

  public async registerResources() {
    const resources = await importGlob(
      './src/resources/**/*.ts'
    );
    resources
      .map(module => module.default)
      .map((Resource: NonAbstractResourceLikeConstructor) => new Resource());
  }

  public registerMiddleware(middlewares: (MiddlewareHandler)[]) {
    middlewares.forEach((middleware) => this.app.use(middleware));
  }

  public registerErrorHandler(errorHandler: ErrorHandler) {
    this.app.onError(errorHandler);
  }

  public get app() {
    return AppServer.#app;
  }

  public get services() {
    return this.#services;
  }
}
