import type { ErrorHandler as HonoErrorHandler } from 'jsr:@hono/hono@4.6.14';
import { HttpError, InternalServerError } from "../common/errors.ts";
import { ContentTypes, Headers } from "../common/enums.ts";

export const ErrorHandler: HonoErrorHandler = (error, context) => {
  if ((error instanceof HttpError) === false) {
    error = new InternalServerError('There was an error. Please contact support@queued-in.com.', { cause: error });
    context.error = error;
  }

  context.status((error as HttpError).status);
  const response = context.json({
    type: (error as HttpError).type,
    title: error.name,
    status: (error as HttpError).status,
    detail: error.message,
    trace: context.res.headers.get(Headers.TraceId),
    instance: context.req.path,
    ...(error as HttpError).extensions,
  });
  response.headers.set(Headers.ContentType, ContentTypes.ProblemDetails);
  return Promise.resolve(response);
};