import type { Context, Next } from 'hono';
import type { MiddlewareHandler } from 'hono/types';
import { AsyncContext } from '../common/async-context.ts';

export const asyncContext = new AsyncContext.Variable<Context>({
  name: 'hono-context',
});

export const AsyncContextProvider = (): MiddlewareHandler => {
  return (context: Context, next: Next) => {
    return asyncContext.run(context, next);
  };
};