import type { ErrorHandler as HonoErrorHandler } from 'jsr:@hono/hono@4.6.14';
import { InternalServerError } from "../common/errors.ts";
import { ContentTypes, Headers } from "../common/enums.ts";
import { isSuppressedError } from "../common/types.ts";
import { Application } from "../index.ts";
import { HttpError } from "../HttpError.ts";

export const ErrorHandler: HonoErrorHandler = (error, context) => {
  if (isSuppressedError(error))
    error = error.error ?? error.suppressed; // error.error contains user error, error.suppressed contains rollback error
  if (!HttpError[Symbol.hasInstance](error)) {
    error = new InternalServerError('There was an error.', { cause: error });
    context.error = error;
  }

  const httpError = error as HttpError;
  httpError.traceparent = context.res.headers.get(Headers.Traceparent);
  httpError.instance = context.req.url;
  Application.instance.dispatchEvent(
    new ErrorEvent('httpError', {
      error: httpError,
      message: httpError.message
    })
  );
  return Promise.resolve(
    context.json(
      httpError,
      httpError.status,
      { [Headers.ContentType]: ContentTypes.ProblemDetails }
    )
  );
};