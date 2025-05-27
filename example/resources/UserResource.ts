import { Result, HttpStatusCodes } from '@resourceful-hono/core';
import BaseResource from './BaseResource.ts';

export default class UserResource extends BaseResource {
  public GET() {
    return Result(HttpStatusCodes.Ok, { username: 'absurdprofit' });
  }
}