import type { MiddlewareHandler } from 'jsr:@hono/hono@4.6.14';
import { Application } from "../Application.ts";
import { LogService } from "../LogService/LogService.ts";

export const Logger: MiddlewareHandler = async (context, next) => {
  await next();
  const logger = Application.instance.getService(LogService);
  if (context.error)
    logger.error(context.error, { context });
  else
    logger.info('', { context });
};