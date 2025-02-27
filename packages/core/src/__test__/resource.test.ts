import { expect } from "expect";
import { HttpStatusCodes } from "../common/enums.ts";
import { Result, Resource } from "../Resource.ts";
import { Application } from "../index.ts";

const _app = Application.instance;
const origin = 'http://localhost:8080';

Deno.test("Resources can't extend non-virtual resources", () => {
  class BaseResource extends Resource {
    public GET() {
      return Result(HttpStatusCodes.Ok);
    }
  }

  class TestResource extends BaseResource {
    public override GET() {
      return Result(HttpStatusCodes.Ok);
    }
  }

  expect(() => {
    const _resource = new TestResource();
  }).toThrow(
    'TestResource cannot extend BaseResource. Resources must extend abstract/virtual resources.'
  );
});

Deno.test('Resource returns 200 for defined method', async () => {
  class TestResource extends Resource {
    public GET() {
      return Result(HttpStatusCodes.Ok);
    }
  }
  const _resource = new TestResource();
  const url = new URL('test', origin);
  const response = await Resource.hono.request(url);
  
  expect(response.status).toBe(HttpStatusCodes.Ok);
});