import { Redirect, HttpStatusCodes } from '@resourceful-hono/core';
import BaseResource from './BaseResource.ts';
import JSONResource from './JSONResource.ts';

export default class RedirectResource extends BaseResource {
  public GET() {
    return Redirect(HttpStatusCodes.Found, JSONResource);
  }

  public POST() {
    return Redirect(HttpStatusCodes.SeeOther, JSONResource);
  }

  public PATCH() {
    return Redirect(HttpStatusCodes.TemporaryRedirect, 'https://google.com');
  }

  public DELETE() {
    return Redirect(HttpStatusCodes.PermanentRedirect, JSONResource);
  }
}