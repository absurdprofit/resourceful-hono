import { expect } from "expect";
import { ContentTypes, Headers, HttpStatusCodes } from "../common/enums.ts";
import { Result, Resource } from "../Resource.ts";
import { Application, Route } from "../index.ts";
import { Hono } from "hono";
import { Accept, FromBody, FromQuery, FromRoute } from "../common/decorators.ts";
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

Deno.test('Parameter decorator throws on composition', () => {
  // hack to remove resources
  cleanupResources();
  
  expect(() => {
    class TestResource extends Resource {
      public GET(
        @FromRoute('id', z.string()) @FromQuery('id', z.string()) id: string
      ) {
        return id;
      }
    }
  }).toThrow('Parameter decorators cannot be composed');

  expect(() => {
    class TestResource extends Resource {
      public GET(
        @FromQuery('id', z.string()) @FromRoute('id', z.string())  id: string
      ) {
        return id;
      }
    }
  }).toThrow('Parameter decorators cannot be composed');
  
  expect(() => {
    class TestResource extends Resource {
      public POST(
        @FromBody('id', z.string()) @FromRoute('id', z.string())  id: string
      ) {
        return id;
      }
    }
  }).toThrow('Parameter decorators cannot be composed');
});

Deno.test('Route decorator disallows path params and wildcards', () => {
  expect(() => {
    @Route('user/:id')
    class TestResource extends Resource {
      public GET() {
        return Result(HttpStatusCodes.Ok);
      }
    }
  }).toThrow(
    'Your route includes a path param which must be a mistake. Path params are automatically inferred.'
  );

  expect(() => {
    @Route('user2/*')
    class SecondTestResource extends Resource {
      public GET() {
        return Result(HttpStatusCodes.Ok);
      }
    }
  }).toThrow(
    'Your route includes a wildcard which must be a mistake. Wildcards are automatically inferred.'
  );
});

Deno.test('Resource overrides route with Route decorator', async () => {
  // hack to remove resources
  cleanupResources();

  @Route('user')
  class TestResource extends Resource {
    public GET() {
      return Result(HttpStatusCodes.Ok);
    }
  }

  const _resource = new TestResource();
  const url = new URL('user', origin);
  const response = await Resource.hono.request(url);

  expect(response.status).toBe(HttpStatusCodes.Ok);
});

Deno.test('Resource parses using FromRoute decorator', async () => {
  // hack to remove resources
  cleanupResources();

  const schema1 = z.object({ id: z.string() });
  const schema2 = schema1.shape.id;
  const schema3 = z.object({ id2: z.coerce.number() });
  class TestResource extends Resource {
    public GET(
      @FromRoute(schema1) object: z.infer<typeof schema1>,
      @FromRoute('id', schema2) id: z.infer<typeof schema2>,
      @FromRoute(schema3) object2: z.infer<typeof schema3>
    ) {
      return Result(HttpStatusCodes.Ok, { object, id, object2 });
    }
  }
  const _resource = new TestResource();
  const id = crypto.randomUUID();
  const id2 = 10;
  const url = new URL(`test/${id}/${id2}`, origin);
  const response = await Resource.hono.request(url);
  const json = await response.json();
  
  expect(response.status).toBe(HttpStatusCodes.Ok);
  expect(json['object']).toStrictEqual({ id });
  expect(json['id']).toStrictEqual(id);
  expect(json['object2']).toStrictEqual({ id2 });
});

Deno.test('Resource parses using FromQuery decorator', async () => {
  // hack to remove resources
  cleanupResources();

  const schema1 = z.object({ id: z.string() });
  const schema2 = schema1.shape.id;
  const schema3 = z.object({ id2: z.coerce.number() });
  class TestResource extends Resource {
    public GET(
      @FromQuery(schema1) object: z.infer<typeof schema1>,
      @FromQuery('id', schema2) id: z.infer<typeof schema2>,
      @FromQuery(schema3) object2: z.infer<typeof schema3>
    ) {
      return Result(HttpStatusCodes.Ok, { object, id, object2 });
    }
  }
  const _resource = new TestResource();
  const id = crypto.randomUUID();
  const id2 = 10;
  const url = new URL('test', origin);
  url.searchParams.set('id', id);
  url.searchParams.set('id2', id2.toString());
  const response = await Resource.hono.request(url);
  const json = await response.json();
  
  expect(response.status).toBe(HttpStatusCodes.Ok);
  expect(json['object']).toStrictEqual({ id });
  expect(json['id']).toStrictEqual(id);
  expect(json['object2']).toStrictEqual({ id2 });
});

Deno.test('Resource parses using FromBody decorator', async () => {
  // hack to remove resources
  cleanupResources();

  const schema1 = z.object({ id: z.string() });
  const schema2 = schema1.shape.id;
  const schema3 = z.object({ id2: z.coerce.number() });
  class TestResource extends Resource {
    public POST(
      @FromBody(schema1) object: z.infer<typeof schema1>,
      @FromBody('id', schema2) id: z.infer<typeof schema2>,
      @FromBody(schema3) object2: z.infer<typeof schema3>
    ) {
      return Result(HttpStatusCodes.Ok, { object, id, object2 });
    }
  }
  const _resource = new TestResource();
  const id = crypto.randomUUID();
  const id2 = 10;
  const url = new URL('test', origin);
  const body = JSON.stringify({
    id,
    id2
  });
  const response = await Resource.hono.request(
    url,
    { 
      body,
      method: 'post',
      headers: {
        [Headers.ContentType]: ContentTypes.Json
      }
    }
  );
  const json = await response.json();
  
  expect(response.status).toBe(HttpStatusCodes.Ok);
  expect(json['object']).toStrictEqual({ id });
  expect(json['id']).toStrictEqual(id);
  expect(json['object2']).toStrictEqual({ id2 });
});
