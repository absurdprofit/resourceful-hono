import { ContentTypeHandler } from "@resourceful-hono/core";

export const plainTextHandler: ContentTypeHandler = {
  decode(resource) {
    return resource.text();
  },
  encode(data) {
    return String(data);
  },
}