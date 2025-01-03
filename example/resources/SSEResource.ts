import { Result, ServerSentEvent } from "../../packages/core/src/index.ts";
import BaseResource from "./BaseResource.ts";

export default class SSEResource extends BaseResource {
  GET() {
    return Result(200, function* () {
      yield new ServerSentEvent('hello', { data: 'world' });
      yield new ServerSentEvent('hello', { data: 'world', comment: 'repeat' });
    }, 'text/event-stream');
  }
}