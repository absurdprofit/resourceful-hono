import type { z } from 'zod';
import { type NonAbstractResourceLikeConstructor, Resource } from '../Resource.ts';
import type { RequestMethod } from './enums.ts';
import type { ServerSentEvent } from '../ServerSentEvent.ts';
import type { ContentTypeHandler } from '../ContentTypeRegistry.ts';
import { etag } from 'hono/etag';

export type Constructor<T = unknown> = abstract new (...args: never[]) => T;
export type PrimitiveType = z.ZodString | z.ZodNumber | z.ZodBoolean | z.ZodLiteral<unknown> | z.ZodNativeEnum<z.EnumLike> | z.ZodEnum<[string, ...string[]]>;
export interface ParameterMetadata<T extends z.ZodType = z.ZodType> {
  schema: T;
  type: 'route' | 'query' | 'body';
  key?: string;
  keys?: string[];
}

export function isResourceConstructor(value: unknown): value is NonAbstractResourceLikeConstructor {
  return typeof value === 'function' && value.prototype instanceof Resource;
}

export function isBodyInit(value: unknown): value is BodyInit {
  return typeof value === 'string'
    || value instanceof Blob
    || value instanceof ArrayBuffer
    || value instanceof FormData
    || value instanceof URLSearchParams
    || value instanceof ReadableStream;
}

export type ResourceMethodReturn =
  Promise<Response | void>
  | Response | void;

export type ResourceMethod = `${RequestMethod}`;

export function isSuppressedError(value: unknown): value is SuppressedError {
  return value instanceof Error && 'suppressed' in value;
}

export type ServerSentEventGenerator = () => Generator<ServerSentEvent, void, unknown> | AsyncGenerator<ServerSentEvent, void, unknown>;

export type OwnProperties<T> = { -readonly [P in keyof T]: TypedPropertyDescriptor<T[P]>; }

export type SimpleContentTypeRegistry = {
  use: (pattern: string | string[], handler: ContentTypeHandler) => void;
  get: (contentType: string) => ContentTypeHandler | undefined;
};

export interface DefaultContextVariables {
  activeRequests: number;
  traceparent: {
    spanId: string;
    traceId: string;
    parentId: string;
  }
}

export interface CacheStaleOptions {
  ifError?: number;
  whileRevalidate?: number;
}

export interface CacheControlOptions {
  maxAge?: number;
  public?: boolean;
  revalidate?: boolean;
  stale?: CacheStaleOptions;
}

export type EtagOptions = Parameters<typeof etag>[number];