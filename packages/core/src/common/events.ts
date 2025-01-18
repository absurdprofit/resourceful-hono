import { PromiseAllDynamic } from "./utils.ts";

export class ReadyEvent extends Event {
  readonly #promises: Promise<void>[] = [];

  constructor(resolve: (value: void) => void) {
    super('ready', {
      bubbles: false,
      cancelable: false,
      composed: false
    });
    this.#promises.push(new Promise<void>((resolve) => queueMicrotask(resolve)));
    PromiseAllDynamic(this.#promises).then(() => resolve());
  }

  public waitUntil = (promise: Promise<void>): void => {
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