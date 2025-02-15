import { EventSource } from "eventsource";
import { ContentTypeRouter } from "../ContentTypeRouter.ts";
import { TIMING_METRIC_DURATION_REGEX } from './constants.ts';
import { ContentTypes, Headers } from "./enums.ts";
import { GenericHttpError } from "./errors.ts";

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

export function createGlobalContentTypeRouter() {
  const router = new ContentTypeRouter();
  router.use('*', ContentTypes.Json, {
    decode(resource) {
      return resource.json();
    },
    encode(object) {
      return JSON.stringify(object);
    },
  });
  router.use('*', ContentTypes.ProblemDetails, {
    async decode(resource) {
      return new GenericHttpError(await resource.json());
    },
    encode(data) {
      return JSON.stringify(data);
    },
  });
  router.use('*', [
    ContentTypes.FormUrlEncoded,
    ContentTypes.MultipartFormData
  ], {
    decode(resource) {
      return resource
        .formData()
        .then(formData => 
          Object.fromEntries(formData.entries())
        );
    },
    encode(data) {
      return toFormData(data);
    },
  });
  router.use('*', [
    ContentTypes.ServerSentEvent,
    ContentTypes.OctetStream
  ], {
    decode(resource) {
      if (resource.headers.get(Headers.ContentType) === ContentTypes.ServerSentEvent) {
        let response;
        if (resource instanceof Request)
          response = new Response(
            resource.body,
            { headers: resource.headers }
          );
        else
          response = resource;

        return new EventSource(
          resource.url,
          { fetch: () => Promise.resolve(response) }
        );
      } else {
        return resource.body;
      }
    },
    encode(data) {
      if (typeof data === 'function') {
        return createReadableFromIterable(data());
      }
      if (data instanceof ReadableStream)
        return data;
      throw new TypeError('Only generators or ReadableStreams can be turned into Resource streams');
    },
  });

  return router;
}