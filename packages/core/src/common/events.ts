import type { Context, Env, Input } from 'hono';
import { PromiseAllDynamic } from './utils.ts';
import { DefaultContextVariables } from './types.ts';

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

export class RequestEvent<E extends Env['Bindings'] = object> extends Event {
  public readonly env: E;
  constructor(env: unknown = {}) {
    super('request');

    this.env = env as E;
  }
}


export class ResponseEvent<
  E extends Env = { Variables: DefaultContextVariables },
  P extends string = '',
  I extends Input = object
> extends Event {
  public readonly context: Context<E, P, I>;
  constructor(context: Context) {
    super('response');

    this.context = context;
  }
}
