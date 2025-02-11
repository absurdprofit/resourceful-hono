import { ContentTypes, Result, HttpStatusCodes, FromRoute, FromBody, Accept, FromQuery, Middleware } from "@resourceful-hono/core";
import { z } from 'zod';
import BaseResource from "./BaseResource.ts";

const GETQuery = z.object({ page: z.coerce.number() });
const GETParam = z.object({ name: z.string(), id: z.string().uuid() });
const PUTBody = z.object({ name: z.string(), email: z.string().email(), displayName: z.string() });
@Middleware(async (_context, next) => {
  console.debug('Middleware 1 Start');
  await next();
  console.debug('Middleware 1 End');
})
@Middleware(async (_context, next) => {
  console.debug('Middleware 2 Start');
  await next();
  console.debug('Middleware 2 End');
})
export default class JSONResource extends BaseResource {
  @Middleware(async (_context, next) => {
    await next();
    console.debug('Middleware 3');
  })
  public GET(
    @FromRoute(GETParam) param: z.infer<typeof GETParam>,
    @FromQuery(GETQuery) query: z.infer<typeof GETQuery>
  ) {
    return Result(HttpStatusCodes.Ok, { param, query });
  }

  @Accept([ContentTypes.Json])
  public PUT(@FromBody(PUTBody) data: z.infer<typeof PUTBody>, @FromBody('name', PUTBody.shape.name) name: z.infer<typeof PUTBody['shape']['name']>) {
    console.log(data, name);
  }

  public POST(@FromBody(z.string()) numberString: string) {
    return Result(200);
  }

  public DELETE(@FromBody(PUTBody) body1: z.infer<typeof PUTBody>, @FromBody(GETQuery) body2: z.infer<typeof GETQuery>) {
    return Result(200);
  }
}