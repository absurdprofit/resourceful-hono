import { ContentTypes, Result, HttpStatusCodes, FromRoute, FromBody, Accept, FromQuery } from "@resourceful-hono/core";
import { z } from 'zod';
import BaseResource from "./BaseResource.ts";

export default class JSONResource extends BaseResource {
  public GET(@FromRoute('id', z.string()) id: string, @FromRoute('my', z.string()) my: string, @FromQuery('page', z.coerce.number()) page: number) {
    return Result(HttpStatusCodes.Ok, { hello: id, page });
  }

  @Accept([ContentTypes.Json])
  public POST(@FromBody(z.object({ name: z.string() })) data: { name: string }, @FromBody('name', z.string()) name: string) {
    console.log(data, name);
  }
}