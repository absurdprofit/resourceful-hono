import { expect } from 'expect';
import { ContentTypes, Headers, HttpStatusCodes } from '../common/enums.ts';
import { Result, Resource, Redirect } from '../Resource.ts';
import { Hono } from 'hono';
import { Accept, FromBody, FromQuery, FromRoute, Inject, Middleware, Route } from '../common/decorators.ts';
import { z } from 'zod';
import { Application } from '../Application.ts';
import { ServerSentEvent } from '../ServerSentEvent.ts';
import { PromiseWrapper } from '../common/promise-wrapper.ts';

class DummyService {
  public value = true;
  public disposed = false;

  public [Symbol.dispose]() {
    this.disposed = true;
  }
}

const app = Application.instance;
const promiseWrapper = new PromiseWrapper<void>();
app.addEventListener('ready', (e) => e.waitUntil(promiseWrapper.promise));
const origin = 'http://localhost:8080';

function cleanupResources() {
  Object.defineProperty(Resource, 'hono', {
    value: new Hono({ strict: true }),
    writable: false,
  });
}

Deno.test('Resource service injection throws if service doesn\'t exist', () => {
  // hack to remove resources
  cleanupResources();

  expect(() => {
    class TestResource extends Resource {
      @Inject()
      declare public readonly service: DummyService;
  
      public GET() {
        return Result(HttpStatusCodes.Ok, {
          responseTime: performance.now(),
        });
      }
    }
  
    const _resource = new TestResource();
    const _service = _resource.service;
  }).toThrow(
    'Service DummyService not found.'
  );
});

Deno.test('Resource service injection works', () => {
  // hack to remove resources
  cleanupResources();

  class TestResource extends Resource {
    @Inject()
    declare public readonly service: DummyService;

    public GET() {
      return Result(HttpStatusCodes.Ok, {
        responseTime: performance.now(),
      });
    }
  }

  app.registerService(DummyService, new DummyService());
  const _resource = new TestResource();
  expect(_resource.service).toBeInstanceOf(DummyService);
});

Deno.test('@Inject throws if service type cannot be inferred', () => {
  // hack to remove resources
  cleanupResources();

  expect(() => {
    class TestResource extends Resource {
      @Inject()
      declare public readonly service: never;
  
      public GET() {
        return Result(HttpStatusCodes.Ok, {
          responseTime: performance.now(),
        });
      }
    }
  
    const _resource = new TestResource();
    const _service = _resource.service;
  }).toThrow(
    'Could not determine type for property service'
  );
});

Deno.test('Resource waits on Application ready state before processing requests', () => {
  // hack to remove resources
  cleanupResources();

  class TestResource extends Resource {
    public GET() {
      return Result(HttpStatusCodes.Ok, {
        responseTime: performance.now(),
      });
    }
  }
  
  const _resource = new TestResource();
  const url = new URL('test', origin);
  let readyTime = Number();

  queueMicrotask(async () => {
    const response = await Resource.hono.request(url);
    const json = await response.json();
    expect(json.responseTime).toBeGreaterThan(readyTime);
  });

  promiseWrapper.resolve();
  readyTime = performance.now();
});

Deno.test('Resources can\'t extend non-virtual resources', () => {
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

Deno.test('Resource methods getter returns only methods implemented', () => {
  class TestResource extends Resource {
    public GET() {}
    public POST() {}
  }

  expect(TestResource.methods).toStrictEqual(['GET', 'POST']);
});

Deno.test('Resource has context, request and response injected', async () => {
  // hack to remove resources
  cleanupResources();

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
    'A handler hasn\'t been registered for application/cbor'
  );
});

Deno.test('Resource returns only allowed methods in OPTIONS request', async () => {
  // hack to remove resources
  cleanupResources();

  class TestResource extends Resource {
    public GET() {}
    public POST() {}
  }
  const _resource = new TestResource();
  const url = new URL('test', origin);
  const response = await Resource.hono.request(url, { method: 'OPTIONS' });
  
  expect(response.status).toBe(HttpStatusCodes.NoContent);
  expect(response.headers.get(Headers.Allow)).toBe('GET, POST');
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
    class _TestResource extends Resource {
      public GET(
        @FromRoute('id', z.string()) @FromQuery('id', z.string()) id: string
      ) {
        return id;
      }
    }
  }).toThrow('Parameter decorators cannot be composed');

  expect(() => {
    class _TestResource extends Resource {
      public GET(
        @FromQuery('id', z.string()) @FromRoute('id', z.string())  id: string
      ) {
        return id;
      }
    }
  }).toThrow('Parameter decorators cannot be composed');
  
  expect(() => {
    class _TestResource extends Resource {
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
    class _TestResource extends Resource {
      public GET() {
        return Result(HttpStatusCodes.Ok);
      }
    }
  }).toThrow(
    'Your route includes a path param which must be a mistake. Path params are automatically inferred.'
  );

  expect(() => {
    @Route('user2/*')
    class _SecondTestResource extends Resource {
      public GET() {
        return Result(HttpStatusCodes.Ok);
      }
    }
  }).toThrow(
    'Your route includes a wildcard which must be a mistake. Wildcards are automatically inferred.'
  );
});

Deno.test('Middleware decorator per resource registers middleware handler', async () => {
  // hack to remove resources
  cleanupResources();

  const testHeader = 'MiddlewareCalled';
  @Middleware((context, next) => {
    context.res.headers.set(testHeader, 'true');
    return next();
  })
  class TestResource extends Resource {
    public GET() {
      return Result(HttpStatusCodes.Ok);
    }

    public POST() {
      return Result(HttpStatusCodes.Ok);
    }
  }

  class SecondTestResource extends Resource {
    public GET() {
      return Result(HttpStatusCodes.Ok);
    }
  }

  const _resource = new TestResource();
  const _resource2 = new SecondTestResource();
  const url = new URL('test', origin);
  const url2 = new URL('secondtest', origin);
  const response = await Resource.hono.request(url);
  const response2 = await Resource.hono.request(url, { method: 'POST' });
  const response3 = await Resource.hono.request(url2);

  expect(response.headers.get(testHeader)).toBe('true');
  expect(response2.headers.get(testHeader)).toBe('true');
  expect(response3.headers.get(testHeader)).toBe(null);
});

Deno.test('Middleware decorator per method registers middleware handler', async () => {
  // hack to remove resources
  cleanupResources();

  const testHeader = 'MiddlewareCalled';
  class TestResource extends Resource {
    @Middleware((context, next) => {
      context.res.headers.set(testHeader, 'true');
      return next();
    })
    public GET() {
      return Result(HttpStatusCodes.Ok);
    }

    public POST() {
      return Result(HttpStatusCodes.Ok);
    }
  }

  class SecondTestResource extends Resource {
    public GET() {
      return Result(HttpStatusCodes.Ok);
    }
  }

  const _resource = new TestResource();
  const _resource2 = new SecondTestResource();
  const url = new URL('test', origin);
  const url2 = new URL('secondtest', origin);
  const response = await Resource.hono.request(url);
  const response2 = await Resource.hono.request(url, { method: 'POST' });
  const response3 = await Resource.hono.request(url2);

  expect(response.headers.get(testHeader)).toBe('true');
  expect(response2.headers.get(testHeader)).toBe(null);
  expect(response3.headers.get(testHeader)).toBe(null);
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

Deno.test('FromRoute decorator registers route with optional param', async () => {
  // hack to remove resources
  cleanupResources();

  const schema1 = z.object({ id: z.string().optional() });
  class TestResource extends Resource {
    public GET(@FromRoute(schema1) object: z.infer<typeof schema1>) {
      return Result(HttpStatusCodes.Ok, { object });
    }
  }
  const _resource = new TestResource();
  const id = crypto.randomUUID();
  let url = new URL(`test/${id}`, origin);
  let response = await Resource.hono.request(url);
  
  expect(response.status).toBe(HttpStatusCodes.Ok);

  url = new URL('test', origin);
  response = await Resource.hono.request(url);
  
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
    id2,
  });
  const response = await Resource.hono.request(
    url,
    { 
      body,
      method: 'post',
      headers: {
        [Headers.ContentType]: ContentTypes.Json,
      },
    }
  );
  const json = await response.json();
  
  expect(response.status).toBe(HttpStatusCodes.Ok);
  expect(json['object']).toStrictEqual({ id });
  expect(json['id']).toStrictEqual(id);
  expect(json['object2']).toStrictEqual({ id2 });
});

Deno.test('Resource intersects non-object types using FromBody decorator', async () => {
  // hack to remove resources
  cleanupResources();

  class TestResource extends Resource {
    public POST(
      @FromBody(z.string()) e: string,
      @FromBody(z.literal('type')) e2: string
    ) {
      return Result(HttpStatusCodes.Ok, { e, e2 });
    }
  }
  const _resource = new TestResource();
  const url = new URL('test', origin);
  const body = JSON.stringify('type');
  const method = 'POST';
  const headers = { [Headers.ContentType]: ContentTypes.Json };
  const response = await Resource.hono.request(url, { body, method, headers });
  const json = await response.json();

  expect(json.e).toBe('type');
  expect(json.e2).toBe('type');

  const body2 = JSON.stringify('types');
  const response2 = await Resource.hono.request(url, { body: body2, method, headers });

  expect(response2.ok).toBe(false);
});

Deno.test('Resource throws if content type is missing', async () => {
  // hack to remove resources
  cleanupResources();

  class TestResource extends Resource {
    public POST(@FromBody(z.string()) data: string) {
      return Result(HttpStatusCodes.Ok, data);
    }
  }

  const _resource = new TestResource();
  const url = new URL('test', origin);
  const body = JSON.stringify('type');
  const method = 'POST';
  const request = new Request(url, { body, method });
  request.headers.delete(Headers.ContentType);
  const response = await Resource.hono.request(request);

  expect(response.ok).toBe(false);
});

Deno.test('Result adds date header', async () => {
  const response = await Result(HttpStatusCodes.Ok);

  const regex = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s*\d{2}\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*\d{4}\s*\d{2}:\d{2}:\d{2}\s*GMT\s*$/;
  expect(response.headers.get(Headers.Date)).toMatch(regex);
});

Deno.test('Result adds required headers for SSE response', async () => {
  const generator = function* () {
    yield new ServerSentEvent('test');
  };
  const response = await Result(HttpStatusCodes.Ok, generator, ContentTypes.ServerSentEvent);

  expect(response.headers.get(Headers.CacheControl)).toBe('no-cache');
  expect(response.headers.get(Headers.Connection)).toBe('keep-alive');
});

Deno.test('Result defaults to octet-stream content type when given a generator', async () => {
  const generator = function* () {
    yield new ServerSentEvent('test');
  };
  const response = await Result(HttpStatusCodes.Ok, generator);

  expect(response.headers.get(Headers.ContentType)).toBe(ContentTypes.OctetStream);
});

Deno.test('Redirect throws on out of bounds status codes', () => {
  expect(() => {
    Redirect(HttpStatusCodes.Ok, '/');
  }).toThrow('Invalid redirect status code: 200');

  expect(() => {
    Redirect(HttpStatusCodes.BadRequest, '/');
  }).toThrow('Invalid redirect status code: 400');
});

Deno.test('Redirect can accept Resource as destination', () => {
  // hack to remove resources
  cleanupResources();

  class TestResource extends Resource {
    public POST() {
      return Result(HttpStatusCodes.Ok);
    }
  }

  const response = Redirect(HttpStatusCodes.PermanentRedirect, TestResource);

  expect(response.status).toBe(HttpStatusCodes.PermanentRedirect);
  expect(response.headers.get(Headers.Location)).toBe(TestResource.pathname);
});