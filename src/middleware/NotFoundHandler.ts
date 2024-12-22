import type { NotFoundHandler as HonoNotFoundHandler } from 'jsr:@hono/hono@4.6.14';
import { NotFoundError } from "../common/errors.ts";

export const NotFoundHandler: HonoNotFoundHandler = ({ req }) => {
  throw new NotFoundError('No Resource found at path: ' + req.path);
};