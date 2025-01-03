import type { MiddlewareHandler } from 'jsr:@hono/hono@4.6.14';
import { AppServer } from "../AppServer.ts";

export const BeforeReady: MiddlewareHandler = async (_, next) => {
  await AppServer.instance.ready('ready');
  await next();
};