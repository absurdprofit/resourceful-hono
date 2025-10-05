import type { ErrorHandler as HonoErrorHandler } from 'hono';
import { InternalServerError } from '../common/errors.ts';
import { ContentTypes, Headers } from '../common/enums.ts';
import { isSuppressedError } from '../common/types.ts';
import { Application, RollbackError } from '../index.ts';
import { HttpError } from '../HttpError.ts';
import { Resource } from '../Resource.ts';

export const ErrorHandler: HonoErrorHandler = async (error, context) => {
  while (isSuppressedError(error)) {
    error = error.error instanceof RollbackError
      ? error.suppressed
      : error.error;
  }

  if (!HttpError[Symbol.hasInstance](error)) {
    error = new InternalServerError('There was an error.', { cause: error });
  }
  
  const httpError = error as HttpError;
  context.error = httpError;
  // TODO: Add support for tracesparent
  httpError.traceparent = '00-00000000000000000000000000000000-0000000000000000-00';
  httpError.instance = context.req.url;
  Application.instance.dispatchEvent(
    new ErrorEvent('httpError', {
      error: httpError,
      message: httpError.message,
    })
  );
  const handler = Resource.contentTypes.get(ContentTypes.ProblemDetails);
  return new Response(
    await handler?.encode(httpError),
    {
      status: httpError.status,
      statusText: httpError.title,
      headers: {
        [Headers.ContentType]: ContentTypes.ProblemDetails,
      },
    }
  );
};