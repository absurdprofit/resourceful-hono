import type { MiddlewareHandler } from 'hono';
import { Headers } from '../common/enums.ts';
import { generateHex } from '../common/utils.ts';
import { SPAN_ID_LENGTH, TRACE_ID_LENGTH } from '../common/constants.ts';

export const TraceContext: MiddlewareHandler = async (context, next) => {
  const incomingTraceparent = context.req.header(Headers.Traceparent);
  const [
    version = '00',
    traceId = generateHex(TRACE_ID_LENGTH),
    parentId,
    flags = '01',
  ] = incomingTraceparent?.split('-') ?? '';

  const spanId = generateHex(SPAN_ID_LENGTH);
  const traceparent = `${version}-${traceId}-${parentId || spanId}-${flags}`;

  context.set(Headers.Traceparent, {
    traceId,
    parentId,
    spanId,
  });
  context.res.headers.set(Headers.Traceparent, traceparent);

  await next();
};
