import type { Constructor } from './common/types.ts';

export type Service = (Disposable | AsyncDisposable | object) & {
  ready?: boolean | Promise<boolean>
};
export class ServiceMap extends Map<Constructor<Service>, Service> {
  public override set<T extends Service>(key: Constructor<T>, value: T): this {
    return super.set(key, value);
  }

  public override get<T extends Service>(key: Constructor<T>): T {
    const value = super.get(key);
    if (!value) {
      throw new Error(`Service ${key.name} not found.`);
    }
    return value as T;
  }

  public get ready() {
    return Promise.all(
      this.values().map(service => service['ready'] ?? true)
    ).then(values => values.every(Boolean));
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