import type { ErrorHandler as HonoErrorHandler } from 'hono';
import { InternalServerError } from '../common/errors.ts';
import { ContentTypes, Headers } from '../common/enums.ts';
import { isSuppressedError } from '../common/types.ts';
import { Application, RollbackError } from '../index.ts';
import { HttpError } from '../HttpError.ts';
import { Resource } from '../Resource.ts';

const ERROR_EVENT_TYPE = 'httpError';
const INTERNAL_SERVER_ERROR = new InternalServerError('There was an error.');
export const ErrorHandler: HonoErrorHandler = async (error, context) => {
  while (isSuppressedError(error)) {
    error = error.error instanceof RollbackError
      ? error.suppressed
      : error.error;
  }

  if (!HttpError[Symbol.hasInstance](error)) {
    INTERNAL_SERVER_ERROR.cause = error;
    error = INTERNAL_SERVER_ERROR;
  }
  
  const httpError = error as HttpError;
  context.error = httpError;

  httpError.instance = context.req.url;
  Application.instance.dispatchEvent(
    new ErrorEvent(ERROR_EVENT_TYPE, {
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