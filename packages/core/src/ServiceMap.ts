import type { Constructor } from './common/types.ts';

export class ServiceMap extends Map {
  public override set<T>(key: Constructor<T>, value: T): this {
    return super.set(key, value);
  }
  public override get<T>(key: Constructor<T>): T {
    const value = super.get(key);
    if (!value) {
      throw new Error(`Service ${key.name} not found.`);
    }
    return value as T;
  }
}