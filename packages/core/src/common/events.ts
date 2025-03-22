import type { Context } from 'hono';
import { PromiseAllDynamic } from './utils.ts';

export class ReadyEvent extends Event {
  readonly #promises: Promise<unknown>[] = [];

  constructor(resolve: (value: void) => void) {
    super('ready', {
      bubbles: false,
      cancelable: false,
      composed: false,
    });
    this.#promises.push(new Promise<void>((resolve) => queueMicrotask(resolve)));
    PromiseAllDynamic(this.#promises).then(() => resolve());
  }

  public waitUntil = (promise: Promise<unknown>): void => {
    this.#promises.push(promise);
  };
}

export class FinishEvent extends Event {
  constructor() {
    super('finish', {
      bubbles: false,
      cancelable: false,
      composed: false,
    });
  }  
}

export class RequestEvent extends Event {
  readonly context: Pick<Context, 'var' | 'env' | 'get' | 'set'>;
  constructor(context: Context) {
    super('request');

    this.context = {
      var: context.var,
      env: context.env,
      get: context.get.bind(context),
      set: context.set.bind(context),
    };
    
  }
}
