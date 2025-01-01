import { expandGlob } from 'jsr:@std/fs@1.0.8';
import { toFileUrl } from 'jsr:@std/path@1.0.8';
import { Headers } from './enums.ts';
import { HttpRequestLog } from "./types.ts";

export async function importGlob(pattern: string, exclude: string[] = []): Promise<{ default: unknown }[]> {
  const results = await Array.fromAsync(expandGlob(pattern, { exclude }));
  const imports = results
    .filter(result => result.isFile)
    .map(({ path }) => import(toFileUrl(path).href));
  const modules = await Promise.all(imports);
  return modules;
}

export function literalToLowerCase<T extends string>(value: T): Lowercase<T> {
  return value.toLowerCase() as Lowercase<T>;
}

export function createHttpRequestLog(req: Request, res: Response): HttpRequestLog {
  const { url, method } = req;
  const { status: statusCode } = res;
  const ip = req.headers.get(Headers.ForwardedFor) ?? '';
  const userAgent = req.headers.get(Headers.UserAgent) ?? '';
  const responseTimeMs = Number(res.headers.get(Headers.ResponseTime));
  const timestamp = res.headers.get(Headers.Timestamp) ?? '';
  return {
    traceId: res.headers.get(Headers.TraceId) ?? '',
    method,
    statusCode,
    url,
    ip,
    userAgent,
    responseTimeMs,
    timestamp,
  };
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
