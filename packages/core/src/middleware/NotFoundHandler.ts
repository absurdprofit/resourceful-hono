import { NotFoundError } from '../common/errors.ts';
import type { NotFoundHandler as INotFoundHandler } from 'hono/types';
import { ErrorHandler } from './ErrorHandler.ts';

const NOT_FOUND_ERROR = new NotFoundError();
const NOT_FOUND_PREFIX = 'No Resource found at path: ';
export const NotFoundHandler: INotFoundHandler = (context) => {
  NOT_FOUND_ERROR.detail = NOT_FOUND_PREFIX + context.req.path;
  return ErrorHandler(
    NOT_FOUND_ERROR,
    context
  );
};