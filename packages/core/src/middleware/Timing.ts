import type { MiddlewareHandler } from 'hono';
import { timing } from 'hono/timing';
import { Headers } from "../common/enums.ts";

const timer = timing();
export const Timing: MiddlewareHandler = (context, next) => {
  context.res.headers.set(Headers.Date, new Date().toUTCString());
  return timer(context, next);
};