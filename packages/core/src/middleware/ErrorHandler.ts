import type { ErrorHandler as HonoErrorHandler } from 'hono';
import { InternalServerError } from "../common/errors.ts";
import { ContentTypes, Headers } from "../common/enums.ts";
import { isSuppressedError } from "../common/types.ts";
import { Application } from "../index.ts";
import { HttpError } from "../HttpError.ts";
import { Resource } from "../Resource.ts";

export const ErrorHandler: HonoErrorHandler = async (error, context) => {
  if (isSuppressedError(error))
    error = error.error ?? error.suppressed; // error.error contains user error, error.suppressed contains rollback error
  if (!HttpError[Symbol.hasInstance](error)) {
    error = new InternalServerError('There was an error.', { cause: error });
  }
  
  const httpError = error as HttpError;
  context.error = httpError;
  httpError.traceparent = context.res.headers.get(Headers.Traceparent);
  httpError.instance = context.req.url;
  Application.instance.dispatchEvent(
    new ErrorEvent('httpError', {
      error: httpError,
      message: httpError.message
    })
  );
  const { encode } = Resource.contentTypes.get(ContentTypes.ProblemDetails) ?? {};
  return new Response(
    await encode?.(httpError),
    {
      status: httpError.status,
      statusText: httpError.title,
      headers: {
        [Headers.ContentType]: ContentTypes.ProblemDetails
      }
    }
  );
};