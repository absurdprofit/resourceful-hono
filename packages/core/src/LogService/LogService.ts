import type { Context } from "jsr:@hono/hono@4.6.14";

export interface LogData {
  payload?: object;
  context?: Context;
  tags?: string[];
}

export abstract class LogService {
  public abstract debug(message: string, data?: LogData): void;
  public abstract info(message: string, data?: LogData): void;
  public abstract warn(message: string, error?: Error | null, data?: LogData): void;
  public abstract error(error: Error, data?: LogData): void;
}