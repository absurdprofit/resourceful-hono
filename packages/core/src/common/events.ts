import { PromiseAllDynamic } from "./utils.ts";

export class ReadyEvent extends Event {
  readonly #promises: Promise<unknown>[] = [];
  public readonly waited: Promise<void>;

  constructor() {
    super('ready', {
      bubbles: false,
      cancelable: false,
      composed: false
    });
    this.#promises.push(new Promise<void>((resolve) => queueMicrotask(resolve)));
    this.waited = PromiseAllDynamic(this.#promises).then(() => void 0);
  }

  public waitUntil = (promise: Promise<unknown>) => {
    this.#promises.push(promise);
  }
}

export class FinishEvent extends Event {
  constructor() {
    super('finish', {
      bubbles: false,
      cancelable: false,
      composed: false
    })
  }  
}