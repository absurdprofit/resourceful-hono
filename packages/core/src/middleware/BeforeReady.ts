import type { MiddlewareHandler } from 'jsr:@hono/hono@4.6.14';
import { Application } from "../Application.ts";

export const BeforeReady: MiddlewareHandler = async (_, next) => {
  await Application.instance.ready;
  await next();
};