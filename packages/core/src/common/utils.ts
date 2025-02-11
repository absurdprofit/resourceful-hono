import { endTime } from "jsr:@hono/hono@4.6.14/timing";
import { TIMING_METRIC_DURATION_REGEX } from './constants.ts';
import type { Timer } from './types.ts';
import type { Context } from "jsr:@hono/hono@4.6.14";
import { Headers } from "./enums.ts";

export function literalToLowerCase<T extends string>(value: T): Lowercase<T> {
  return value.toLowerCase() as Lowercase<T>;
}

export function literalToUpperCase<T extends string>(value: T): Uppercase<T> {
  return value.toUpperCase() as Uppercase<T>;
}

export function createReadableFromIterable<T, TReturn, TNext>(iterable: Iterable<T, TReturn, TNext> | AsyncIterable<T, TReturn, TNext>): ReadableStream {
  const iterator = Symbol.iterator in iterable ? iterable[Symbol.iterator]() : iterable[Symbol.asyncIterator]();
  return new ReadableStream({
    async pull(controller) {
      const { value, done } = await iterator.next();
      if (done) {
        controller.close();
      } else {
        controller.enqueue(value);
      }
    }
  });
}

export async function PromiseAllDynamic<T>(values: Iterable<T | PromiseLike<T>>): Promise<Awaited<T>[]> {
  const awaited = [];
  for (const value of values) {
    awaited.push(await value);
  }

  return awaited;
}

export function parseTotalDuration(input: string[]): string | null {
  for (const item of input) {
    if (!item.startsWith('total'))
      continue;
    
    const match = TIMING_METRIC_DURATION_REGEX.exec(item);
    if (match) {
      return match[1];
    }
  }
  return null;
}

export function endTimers(context: Context, timers: Map<string, Timer>) {
  timers.keys().forEach((name) => {
    endTime(context, name);
  });
  const { headers } = context.get('metric') ?? {};
  if (headers)
    context.res.headers.set(Headers.ServerTiming, headers.join(', '));
}