import type { NotFoundHandler as HonoNotFoundHandler } from 'jsr:@hono/hono@4.6.14';
import { NotFoundError } from "../common/errors.ts";
import { endTimers } from "../common/utils.ts";

export const NotFoundHandler: HonoNotFoundHandler = (context) => {
  const { timers } = context.get('metric') ?? {};
  if (timers)
    endTimers(context, timers);
  throw new NotFoundError('No Resource found at path: ' + context.req.path);
};