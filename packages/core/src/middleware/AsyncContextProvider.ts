import type { Context, Next } from 'hono';
import { Application } from '../Application.ts';
import type { Constructor } from '../common/types.ts';

export type AsyncContextVariable =
  Pick<Context, 'env' | 'var' | 'get' | 'set' | 'error'>
  & { request: Request };

export interface AsyncContextService<T = AsyncContextVariable> {
  run<R>(value: T, fn: (...args: unknown[])=> R, ...args: unknown[]): R;
}

export const AsyncContextProvider = (
  asyncContextService: Constructor<AsyncContextService>
) => {
  return (c: Context, next: Next) => {
    const context = Application.instance.getService(asyncContextService);
    
    return context.run(
      {
        var: c.var,
        env: c.env,
        get: c.get.bind(c),
        set: c.set.bind(c),
        request: c.req.raw.clone(),
        error: c.error,
      },
      next
    );
  };
};