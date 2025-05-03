import type { MiddlewareHandler } from 'hono';
import { Application } from '../Application.ts';
import { AsyncLogService } from '../services/LogService/AsyncLogService.ts';

export const AsyncLogger: MiddlewareHandler = async (context, next) => {
  await next();
  const logger = Application.instance.getService(AsyncLogService);
  if (context.error)
    logger.error(context.error);
  logger.flush();
};