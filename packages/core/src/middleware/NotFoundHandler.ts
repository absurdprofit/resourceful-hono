import { HttpStatusCodes } from "../common/enums.ts";
import { NotFoundError } from "../common/errors.ts";
import type { MiddlewareHandler } from "jsr:@hono/hono@4.6.14/types";

export const NotFoundHandler: MiddlewareHandler = async (context, next) => {
  await next();
  if (context.res.status === HttpStatusCodes.NotFound && !context.error)
    throw new NotFoundError('No Resource found at path: ' + context.req.path);
};