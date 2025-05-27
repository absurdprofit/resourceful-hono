import type { Constructor } from './common/types.ts';

export type DisposableService = Disposable | AsyncDisposable;
export type Service = object | DisposableService;
export class ServiceMap extends Map<Constructor<Service>, Service> {
  public override set<T extends Service>(key: Constructor<T>, value: T): this {
    if (value instanceof key)
      return super.set(key, value);
    throw new TypeError(`Service ${key.name} should be initialised with an instance of ${key.name}.`);
  }

  public override get<T extends Service>(key: Constructor<T>): T {
    const value = super.get(key);
    if (!value) {
      throw new Error(`Service ${key.name} not found.`);
    }
    return value as T;
  }

  public async [Symbol.asyncDispose]() {
    await Promise.all(
      this.values()
        .map(service => {
          if (Symbol.dispose in service)
            return service[Symbol.dispose]();
          if (Symbol.asyncDispose in service)
            return service[Symbol.asyncDispose]();
        })
    );

    this.clear();
  }
}