import { Hono } from 'hono';
import { HEX_RADIX, TIMING_METRIC_DURATION_REGEX } from './constants.ts';
import { Resource } from '../Resource.ts';

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
    },
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

export function toFormData(input: unknown): FormData {
  if (input instanceof FormData) {
    return input;
  }
  
  if (typeof input !== 'object' || input === null) {
    throw new TypeError('Input must be an object or FormData');
  }

  const formData = new FormData();

  for (const [key, value] of Object.entries(input)) {
    if (value instanceof File || value instanceof Blob) {
      formData.append(key, value);
    } else if (Array.isArray(value)) {
      value.forEach((item) => {
        formData.append(key, item);
      });
    } else {
      formData.append(key, String(value));
    }
  }

  return formData;
}

// Helper to generate a random hex string
export function generateHex(bytesCount: number): string {
  const PAD_MAX_COUNT = 2;
  const array = new Uint8Array(bytesCount);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(HEX_RADIX).padStart(PAD_MAX_COUNT, '0'))
    .join('');
}

/**
 * Builds a new Hono instance given a 'leaf' Resource by travelling up the resource tree to build a fully qualified base path.
 * @param instance Leaf instance
 * @returns new Hono app with base path fully qualified base path
 */
export function honoBuilder(instance?: Resource) {
  let parent = instance?.parent;
  const basePaths = new Array<string>();
  let baseApp = new Hono({ strict: true });
  // collect base routes
  while (parent) {
    basePaths.push(parent.route);
    parent = parent.parent;
  }
  // attach base paths
  for (const basePath of basePaths.toReversed()) {
    baseApp = baseApp.basePath(basePath);
  }
  console.log({ parent, basePaths });
  return baseApp.basePath(instance?.route ?? '');
}
