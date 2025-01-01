import type { MiddlewareHandler } from 'jsr:@hono/hono@4.6.14';
import { Headers } from "../common/enums.ts";

export const ResponseTime: MiddlewareHandler = async (context, next) => {
  const start = performance.now();
  context.res.headers.set(Headers.Timestamp, new Date().toISOString());
  await next();
  const end = performance.now();
  context.res.headers.set(Headers.ResponseTime, `${end - start}`);
};