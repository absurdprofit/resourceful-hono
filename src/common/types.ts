import type { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';
import type { HttpStatusCodes } from "./enums.ts";

export type Constructor<T = unknown> = abstract new (...args: never[]) => T;
export type ResourceResult = {
  status: HttpStatusCodes;
  body: BodyInit;
  contentType: string | undefined;
};
export type PrimitiveType = z.ZodString | z.ZodNumber | z.ZodBoolean;
export interface ParameterMetadata<T extends z.ZodType = z.ZodType> {
  [key: string]: {
    type: T;
    parameterIndex: number;
  }
}
export interface HttpRequestLog {
  traceId: string;
  method: string;
  statusCode: number;
  url: string;
  ip: string;
  userAgent: string;
  timestamp: string;
  responseTimeMs: number;
}