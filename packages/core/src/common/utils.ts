import { FIRST_INDEX, SINGLE_ELEMENT_LENGTH, TIMING_METRIC_DURATION_REGEX } from './constants.ts';
import { Hono } from 'hono';
import { Resource } from '../Resource.ts';
import { CacheControlOptions } from './types.ts';

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

/**
 * Builds a new Hono instance given a 'leaf' Resource by travelling up the resource tree to build a fully qualified base path.
 * @param instance Leaf instance
 * @returns new Hono app with base path fully qualified base path
 */
export function honoBuilder(instance?: Resource): Hono {
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
  return baseApp.basePath(instance?.route ?? '');
}

function parseQueryIndex(segment: string) {
  if (segment.startsWith('[') && segment.endsWith(']'))
    return Number(segment.substring(
      SINGLE_ELEMENT_LENGTH,
      segment.length - SINGLE_ELEMENT_LENGTH
    ));
  return segment;
}

export function decodeQuery<T>(params: [string, string][]): T {
  const state: Record<string, unknown> = {
    result: undefined,
  };
  
  for (const [key, value] of params) {
    const stack = key.split('.').reverse();
    let root = state;
    let segment: string | number = 'result';
    while (stack.length) {
      const next = parseQueryIndex(stack.pop()!);
      if (root[segment] === undefined) {
        if (typeof next === 'number') {
          root[segment] = [];
        } else
          root[segment] = {};
      }
      root = root[segment] as Record<string, unknown>;
      segment = next;
    }
    root[segment] = value;
  }

  return state.result as T;
}

export function encodeQuery(object: object) {
  const params: string[] = [];
  const stack: Array<{ path: string[], value: unknown }> = [
    { path: [], value: object },
  ];

  while (stack.length) {
    const { path, value } = stack.pop()!;

    if (Array.isArray(value)) {
      for (let i = FIRST_INDEX; i < value.length; i++) {
        stack.push({ path: [...path, `[${i}]`], value: value[i] });
      }
    } else if (value !== null && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        stack.push({ path: [...path, k], value: v });
      }
    } else if (value !== undefined) {
      params.push(
        `${encodeURIComponent(path.join('.'))}=${encodeURIComponent(String(value))}`
      );
    }
  }

  return params.join('&');
}

export function cacheControlFromOptions(options: CacheControlOptions) {
  if (!options) {
    return 'no-store';
  }

  const directives: string[] = [];

  const {
    maxAge,
    public: isPublic,
    revalidate,
    stale,
  } = options;

  // Visibility
  if (isPublic) {
    directives.push('public');
  } else {
    directives.push('private');
  }

  // max-age
  if (typeof maxAge === 'number' && maxAge > Number()) {
    directives.push(`max-age=${maxAge}`);
  } else if (revalidate) {
    // Revalidation logic
    directives.push('no-cache');
  }

  if (revalidate === false) {
    directives.push('immutable');
  }

  // Stale controls
  if (stale?.ifError) {
    directives.push(`stale-if-error=${stale.ifError}`);
  }

  if (stale?.whileRevalidate) {
    directives.push(
      `stale-while-revalidate=${stale.whileRevalidate}`
    );
  }

  return directives.join(', ');
}