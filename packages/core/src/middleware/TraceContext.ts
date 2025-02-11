import type { MiddlewareHandler } from "hono";
import { Headers } from "../common/enums.ts";

// Helper to generate a random hex string
function generateHex(bytesCount: number): string {
  const array = new Uint8Array(bytesCount);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const TraceContext: MiddlewareHandler = async (context, next) => {
  const incomingTraceparent = context.req.header(Headers.Traceparent);
  let traceId: string | undefined;
  let flags = "01";

  if (incomingTraceparent) {
    const parts = incomingTraceparent.split("-");
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
    spanId
  });
  context.res.headers.set(Headers.Traceparent, traceparent);

  await next();
}
