import { expect } from "expect";
import { HttpStatusCodes } from "../common/enums.ts";
import { Result, Resource } from "../Resource.ts";
import { Application } from "../index.ts";
import { Hono } from "hono";
import { Accept, FromRoute } from "../common/decorators.ts";
import { z } from "zod";

const _app = Application.instance;
const origin = 'http://localhost:8080';

function cleanupResources() {
  Object.defineProperty(Resource, 'hono', {
    value: new Hono({ strict: true }),
    writable: false,
  });
}

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

Deno.test('Resource has context, request and response injected', async () => {
  let context: Resource['context'] = null!;
  let request;
  let response;
  class TestResource extends Resource {
    public GET() {
      context = this.context;
      request = this.request;
      response = this.response;
      return Result(HttpStatusCodes.Ok);
    }
  }
  const _resource = new TestResource();
  const url = new URL('test', origin);
  await Resource.hono.request(url);

  expect(request).toBeInstanceOf(Request);
  expect(response).toBeInstanceOf(Response);
  expect(context.req.raw).toBe(request);
});

Deno.test('Resource cannot Accept unregistered content type', () => {
  // hack to remove resources
  cleanupResources();

  class TestResource extends Resource {
    @Accept(['application/cbor'])
    public GET() {
      return Result(HttpStatusCodes.Ok);
    }
  }

  expect(() => {
    const _resource = new TestResource();
  }).toThrow(
    "A handler hasn't been registered for application/cbor"
  );
});

Deno.test('Resource returns 200 for defined method', async () => {
  // hack to remove resources
  cleanupResources();

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