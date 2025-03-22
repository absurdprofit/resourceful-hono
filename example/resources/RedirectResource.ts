import { Redirect } from '@resourceful-hono/core';
import BaseResource from './BaseResource.ts';
import { HttpStatusCodes } from '../../packages/core/src/common/enums.ts';
import JSONResource from './JSONResource.ts';

export default class RedirectResource extends BaseResource {
  GET() {
    return Redirect(HttpStatusCodes.Found, JSONResource);
  }

  POST() {
    return Redirect(HttpStatusCodes.SeeOther, JSONResource);
  }

  PATCH() {
    return Redirect(HttpStatusCodes.TemporaryRedirect, 'https://google.com');
  }

  DELETE() {
    return Redirect(HttpStatusCodes.PermanentRedirect, JSONResource);
  }
}