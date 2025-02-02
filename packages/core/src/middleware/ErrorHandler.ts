import type { ErrorHandler as HonoErrorHandler } from 'jsr:@hono/hono@4.6.14';
import { HttpError, InternalServerError } from "../common/errors.ts";
import { ContentTypes, Headers } from "../common/enums.ts";
import { isSuppressedError } from "../common/types.ts";

export const ErrorHandler: HonoErrorHandler = (error, context) => {
  if (isSuppressedError(error))
    error = error.error ?? error.suppressed; // error.error contains user error, error.suppressed contains rollback error
  if ((error instanceof HttpError) === false) {
    error = new InternalServerError('There was an error.', { cause: error });
    context.error = error;
  }

  return Promise.resolve(
    context.json({
      ...error,
      trace: context.res.headers.get(Headers.TraceId),
      instance: context.req.url,
    }, (error as HttpError).status, { [Headers.ContentType]: ContentTypes.ProblemDetails })
  );
};