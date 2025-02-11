import type { MiddlewareHandler } from 'hono';
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