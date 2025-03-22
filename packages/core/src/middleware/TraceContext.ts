import type { MiddlewareHandler } from 'hono';
import { Headers } from '../common/enums.ts';
import { generateHex } from '../common/utils.ts';

export const TraceContext: MiddlewareHandler = async (context, next) => {
  const incomingTraceparent = context.req.header(Headers.Traceparent);
  let traceId: string | undefined;
  let flags = '01';

  if (incomingTraceparent) {
    const parts = incomingTraceparent.split('-');
    if (parts.length === 4) {
      traceId = parts[1];
      flags = parts[3];
    }
  }

  if (!traceId) {
    traceId = generateHex(16);
  }

  const spanId = generateHex(8);

  const traceparent = `00-${traceId}-${spanId}-${flags}`;

  context.set(Headers.Traceparent, {
    traceId,
    spanId,
  });
  context.res.headers.set(Headers.Traceparent, traceparent);

  await next();
};
