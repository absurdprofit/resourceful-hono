import { HttpStatusCodes } from '../common/enums.ts';
import { NotFoundError } from '../common/errors.ts';
import type { MiddlewareHandler } from 'hono/types';

export const NotFoundHandler: MiddlewareHandler = async (context, next) => {
  await next();
  if (context.res.status === HttpStatusCodes.NotFound && !context.error)
    throw new NotFoundError('No Resource found at path: ' + context.req.path);
};