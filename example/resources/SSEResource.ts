import { Result, ServerSentEvent } from "@resourceful-hono/core";
import BaseResource from "./BaseResource.ts";
import { ContentTypes } from "../../packages/core/src/common/enums.ts";

export default class SSEResource extends BaseResource {
  GET() {
    return Result(200, function* () {
      yield new ServerSentEvent('hello', { data: 'world' });
      yield new ServerSentEvent('hello', { data: 'world', comment: 'repeat' });
    }, ContentTypes.ServerSentEvent);
  }
}