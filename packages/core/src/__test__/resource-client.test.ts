import { expect } from "expect";
import { Application } from "../Application.ts";
import { HttpStatusCodes } from "../common/enums.ts";
import { Redirect, Resource, Result } from "../Resource.ts";
import { FromBody, FromRoute } from "../common/decorators.ts";
import { z } from "zod";

class RedirectResource extends Resource {
  public GET() {
    return Result(HttpStatusCodes.Ok);
  }

  public POST(@FromBody(z.object({ name: z.string() })) object: { name: string }) {
    return Result(HttpStatusCodes.Ok, { object, redirected: true });
  }

  public PUT() {
    return void 0;
  }
}

class TestResource extends Resource {
  public GET() {
    return Result(HttpStatusCodes.Ok, {
      hello: 'world'
    });
  }

  public POST(@FromBody(z.object({ name: z.string() })) _object: { name: string }) {
    return Redirect(HttpStatusCodes.PermanentRedirect, RedirectResource);
  }

  public PATCH(
    @FromRoute(z.object({ id: z.coerce.number(), name: z.string() })) fromRoute: { id: number, name: string },
    @FromBody(z.string()) fromBody: string
  ) {
    return Result(HttpStatusCodes.Ok, { fromRoute, fromBody });
  }
}

const origin = 'http://localhost:8000';
const test = TestResource.createClient(origin);
const redirect = RedirectResource.createClient(origin);

Application.instance.registerResources([
  RedirectResource,
  TestResource
]);

Deno.serve(Application.instance.fetch);

Deno.test('ResourceClient only includes methods defined on Resource', () => {
  expect(test.get).toBeDefined();
  expect(test.GET).toBeDefined();
  expect('delete' in test).toBe(false);
  expect('DELETE' in test).toBe(false);
});

Deno.test('ResourceClient.toString() returns resource specific values', () => {
  expect(test.toString().includes('TestResourceClient')).toBeTruthy();
});

Deno.test('ResourceClient follows redirects', async () => {
  const object = await test.post({ name: 'surd' });

  expect(object).toStrictEqual({
    object: {
      name: 'surd'
    },
    redirected: true
  });
});

Deno.test('Resource correctly constructs path params', async () => {
  const fromRoute = {
    id: 10,
    name: 'surd'
  };
  const fromBody = 'hello';
  const result = await test.PATCH(
    fromRoute,
    fromBody
  );

  expect(result).toStrictEqual({
    fromRoute,
    fromBody
  });
});