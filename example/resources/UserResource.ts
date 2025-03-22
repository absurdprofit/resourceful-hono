import { Result } from '@resourceful-hono/core';
import BaseResource from './BaseResource.ts';

export default class UserResource extends BaseResource {
  GET() {
    return Result(200, { username: 'absurdprofit' });
  }
}