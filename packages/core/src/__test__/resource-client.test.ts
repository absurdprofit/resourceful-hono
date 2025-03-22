import { expect } from 'expect';
import { Application } from '../Application.ts';
import { HttpStatusCodes } from '../common/enums.ts';
import { Redirect, Resource, Result } from '../Resource.ts';
import { Accept, FromBody, FromQuery, FromRoute } from '../common/decorators.ts';
import { z } from 'zod';
import { NotFoundError, UnsupportedMediaTypeError } from '../common/errors.ts';

class RedirectResource extends Resource {
  public GET() {
    return Result(HttpStatusCodes.Ok);
  }

  public POST(@FromBody(z.object({ name: z.string() })) object: { name: string }) {
    return Result(HttpStatusCodes.Ok, { object, redirected: true });
  }
}

class TestResource extends Resource {
  public GET(@FromQuery('throw', z.coerce.boolean()) shouldThrow: boolean) {
    if (shouldThrow)
      throw new NotFoundError('Resource not found');
    return Result(HttpStatusCodes.Ok, {
      hello: 'world',
    });
  }

  public PUT(
    @FromRoute('id', z.coerce.number()) id: number,
    @FromRoute('id2', z.coerce.number()) id2: number,
    @FromBody(z.object({ name: z.string() })) object: { name: string },
    @FromBody(z.object({ displayName: z.string() })) object2: { displayName: string }
  ) {
    return Result(
      HttpStatusCodes.Ok,
      { ...object, ...object2, id, id2 }
    );
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

  public DELETE(
    @FromRoute(z.object({ id: z.string() })) _object: { id: string },
    @FromRoute(z.object({ id2: z.string() })) _object2: { id2: string }
  ) {
    return void 0;
  }
}

class UnsupportedContentResource extends Resource {
  public GET() {
    return Result(
      HttpStatusCodes.Ok,
      '<svg></svg>',
      'image/svg+xml'
    );
  }

  @Accept(['image/svg+xml'])
  public POST(@FromBody(z.string()) svg: string) {
    return Result(HttpStatusCodes.Ok, svg);
  }
}

Resource.contentTypes.use('image/svg+xml', {
  encode(data) {
    return String(data);
  },
  decode(resource) {
    return resource.text();
  },
});

const origin = 'http://localhost:8000';
const test = TestResource.createClient(origin);
const unsupportedContent = UnsupportedContentResource.createClient(origin);

Application.instance.registerResources([
  RedirectResource,
  TestResource,
  UnsupportedContentResource,
]);

Deno.serve(Application.instance.fetch);

Deno.test('Resource.createClient throws if origin is not defined', () => {
  expect(() => {
    TestResource.createClient();
  }).toThrow(
    'origin is undefined.'
  );
});

Deno.test('Resource.createClient infers origin from globalThis.location', () => {
  expect(() => {
    Object.create(Location.prototype, {
      origin: {
        value: 'localhost:8000',
      },
    });
    globalThis.location = Object.create(
      Location.prototype,
      {
        origin: {
          value: 'localhost:8000',
        },
      }
    );
    TestResource.createClient();  
  }).not.toThrow();
});

Deno.test('ResourceClient only includes methods defined on Resource', () => {
  expect(unsupportedContent.get).toBeDefined();
  expect(unsupportedContent.GET).toBeDefined();
  expect('delete' in unsupportedContent).toBe(false);
  expect('DELETE' in unsupportedContent).toBe(false);
});

Deno.test('ResourceClient.toString() returns resource specific values', () => {
  expect(test.toString().includes('TestResourceClient')).toBeTruthy();
});

Deno.test('ResourceClient follows redirects', async () => {
  const object = await test.post({ name: 'surd' });

  expect(object).toStrictEqual({
    object: {
      name: 'surd',
    },
    redirected: true,
  });
});

Deno.test('ResourceClient correctly constructs path params', async () => {
  const fromRoute = {
    id: 10,
    name: 'surd',
  };
  const fromBody = 'hello';
  const result = await test.PATCH(
    fromRoute,
    fromBody
  );

  expect(result).toStrictEqual({
    fromRoute,
    fromBody,
  });
});

Deno.test('ResourceClient accepts abort signal as parameter and aborts a request', () => {
  const controller = new AbortController();
  
  queueMicrotask(controller.abort.bind(controller));
  expect(test.get(false, controller.signal)).rejects.toThrow(
    'The signal has been aborted'
  );
});

Deno.test('ResourceClient reconstructs HttpError', async () => {
  try {
    await test.get(true);
  } catch (e) {
    expect(e).toBeInstanceOf(NotFoundError);
  }
});

Deno.test('ResourceClient can merge object types', async () => {
  const id = 10;
  const id2 = 1;
  const object = { name: 'Nathan' };
  const object2 = { displayName: 'surd' };
  
  const result = await test.put(id, id2, object, object2);
  expect(result).toStrictEqual({ ...object, ...object2, id, id2 });
});

Deno.test('ResourceClient throws for unsupported content types', async () => {
  const decodeError = await unsupportedContent.get().catch(e => e);
  const encodeError = await unsupportedContent.post('<svg></svg>').catch(e => e);
  expect(decodeError).toBeInstanceOf(UnsupportedMediaTypeError);
  expect(encodeError).toBeInstanceOf(UnsupportedMediaTypeError);
});

Deno.test('ResourceClient returns undefined for void results', async () => {
  const result = await test.delete({ id: 'absurd' }, { id2: 'profit' });

  expect(result).toBe(undefined);
});