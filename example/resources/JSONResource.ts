import { ContentTypes, Result, HttpStatusCodes, FromRoute, FromBody, Accept } from "@resourceful-hono/core";
import { z } from 'zod';
import BaseResource from "./BaseResource.ts";

export default class JSONResource extends BaseResource {
  public GET(@FromRoute('id', z.string()) id: string) {
    return Result(HttpStatusCodes.Ok, { hello: id });
  }

  @Accept([ContentTypes.Json])
  public POST(@FromBody(z.null()) data: null) {
    console.log(data);
  }
}