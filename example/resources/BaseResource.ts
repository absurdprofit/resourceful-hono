import { Resource, Route } from '@resourceful-hono/core';

@Route('/api/v1/')
export default abstract class BaseResource extends Resource {}