import { ContentTypes, Result, HttpStatusCodes, FromRoute, FromBody, Accept, FromQuery } from "@resourceful-hono/core";
import { z } from 'zod';
import BaseResource from "./BaseResource.ts";

export default class JSONResource extends BaseResource {
  public GET(@FromRoute('id', z.string()) id: string, @FromQuery('page', z.coerce.number()) page: number) {
    return Result(HttpStatusCodes.Ok, { hello: id, page });
  }

  @Accept([ContentTypes.Json])
  public POST(@FromBody(z.null()) data: null) {
    console.log(data);
  }
}