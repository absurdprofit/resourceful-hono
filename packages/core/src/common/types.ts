import type { z } from 'npm:zod@3.24.1';
import { type NonAbstractResourceLikeConstructor, Resource } from "../Resource.ts";
import { RequestMethod } from "./enums.ts";
import { ServerSentEvent } from "../ServerSentEvent.ts";

export type Constructor<T = unknown> = abstract new (...args: never[]) => T;
export type PrimitiveType = z.ZodString | z.ZodNumber | z.ZodBoolean;
export interface ParameterMetadata<T extends z.ZodType = z.ZodType> {
  schema: T;
  type: "route" | "query" | "body";
  key?: string;
}

export function isResourceConstructor(value: unknown): value is NonAbstractResourceLikeConstructor {
  return typeof value === "function" && value.prototype instanceof Resource;
}

export function isBodyInit(value: unknown): value is BodyInit {
  return typeof value === 'string'
    || value instanceof Blob
    || value instanceof ArrayBuffer
    || value instanceof FormData || value instanceof URLSearchParams
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

export interface Timer {
  description?: string
  start: number
}