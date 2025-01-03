import { PromiseWrapper } from "./promise-wrapper.ts";

export class AsyncEventTarget<EventMap extends Record<string, Event>> implements EventTarget {
  readonly #listeners: Map<keyof EventMap, Set<EventListenerOrEventListenerObject>>;
  readonly #eventPromises: Map<keyof EventMap, PromiseWrapper<void>>;

  constructor() {
    this.#listeners = new Map();
    this.#eventPromises = new Map();
  }

  addEventListener<K extends keyof EventMap>(type: K, listener: EventListenerOrEventListenerObject | null): void {
    if (!listener) return;
    if (!this.#listeners.has(type)) {
      this.#listeners.set(type, new Set());
    }
    this.#listeners.get(type)!.add(listener);
  }

  removeEventListener<K extends keyof EventMap>(type: K, listener: EventListenerOrEventListenerObject | null): void {
    if (!listener) return;
    this.#listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event: Event): boolean {
    const listeners = this.#listeners.get(event.type);
    if (!listeners || listeners.size === 0) return true;

    const promiseWrapper = this.#eventPromises.get(event.type) || new PromiseWrapper<void>();
    if (!this.#eventPromises.has(event.type)) {
      this.#eventPromises.set(event.type, promiseWrapper);
    }

    const promises = Array.from(listeners).map((listener) => {
      try {
        if (typeof listener === 'function') {
          return listener(event);
        } else if (listener && typeof listener.handleEvent === 'function') {
          return listener.handleEvent(event);
        }
      } catch (error) {
        console.error(`Error in listener for event type '${event.type}':`, error);
      }
      return undefined;
    });

    Promise.all(promises).then(() => {
      promiseWrapper.resolve();
      this.#eventPromises.delete(event.type);
    });

    return true;
  }

  ready<K extends keyof EventMap>(type: K): Promise<void> {
    if (this.#eventPromises.has(type)) {
      return this.#eventPromises.get(type)!.promise;
    }

    const promiseWrapper = new PromiseWrapper<void>();
    this.#eventPromises.set(type, promiseWrapper);
    return promiseWrapper.promise;
  }
}
