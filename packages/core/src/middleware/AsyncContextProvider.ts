import type { Context, Next } from 'hono';
import { Application } from '../Application.ts';
import type { Constructor } from '../common/types.ts';
import type { MiddlewareHandler } from 'hono/types';

type ReadonlyRequest = Pick<
  Request,
  'credentials'
  | 'destination'
  | 'headers'
  | 'integrity'
  | 'isHistoryNavigation'
  | 'isReloadNavigation'
  | 'keepalive'
  | 'method'
  | 'mode'
  | 'redirect'
  | 'signal'
  | 'referrer'
  | 'referrerPolicy'
  | 'url'
>

type ReadonlyResponse = Pick<
  Response,
  'headers' | 'redirected' | 'ok' | 'status' | 'statusText' | 'url'
>

type ReadonlyContext<V extends object | undefined> = Pick<Context<{ Variables: V }>, 'env' | 'var' | 'get' | 'set' | 'error'>

export interface AsyncContextVariable<
  V extends object | undefined = object
> extends ReadonlyContext<V> {
  request: ReadonlyRequest,
  response: ReadonlyResponse
}

export interface AsyncContextService<T = AsyncContextVariable> {
  run(value: T, fn: () => Promise<void>): Promise<void>;
}

export const AsyncContextProvider = (
  asyncContextService: Constructor<AsyncContextService>
): MiddlewareHandler => {
  return (c: Context, next: Next) => {
    const context = Application.instance.getService(asyncContextService);
    
    return context.run(
      {
        var: c.var,
        env: c.env,
        get: c.get.bind(c),
        set: c.set.bind(c),
        request: {
          get headers() {
            return new Headers(c.req.raw.headers);
          },
          get signal() {
            return c.req.raw.signal;
          },
          get credentials() {
            return c.req.raw.credentials;
          },
          get destination() {
            return c.req.raw.destination;
          },
          get integrity() {
            return c.req.raw.integrity;
          },
          get url() {
            return c.req.raw.url;
          },
          get isHistoryNavigation() {
            return c.req.raw.isHistoryNavigation;
          },
          get isReloadNavigation() {
            return c.req.raw.isReloadNavigation;
          },
          get keepalive() {
            return c.req.raw.keepalive;
          },
          get method() {
            return c.req.raw.method;
          },
          get mode() {
            return c.req.raw.mode;
          },
          get redirect() {
            return c.req.raw.redirect;
          },
          get referrer() {
            return c.req.raw.referrer;
          },
          get referrerPolicy() {
            return c.req.raw.referrerPolicy;
          },
        },
        response: {
          get headers() {
            return new Headers(c.res.headers);
          },
          get ok() {
            return c.res.ok;
          },
          get redirected() {
            return c.res.redirected;
          },
          get status() {
            return c.res.status;
          },
          get statusText() {
            return c.res.statusText;
          },
          get url() {
            return c.res.url;
          },
        },
        error: c.error,
      },
      next
    );
  };
};