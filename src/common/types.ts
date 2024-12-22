import type { z } from 'npm:zod@3.24.1';

export type Constructor<T = unknown> = abstract new (...args: never[]) => T;
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