import type { MiddlewareHandler } from 'jsr:@hono/hono@4.6.14';
import { timing } from 'jsr:@hono/hono@4.6.14/timing';
import { Headers } from "../common/enums.ts";

const timer = timing();
export const Timing: MiddlewareHandler = (context, next) => {
  context.res.headers.set(Headers.Date, new Date().toUTCString());
  return timer(context, next);
};