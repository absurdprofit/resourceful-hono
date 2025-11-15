import { expect } from 'expect';
import { Application } from '../Application.ts';
import { Headers, HttpStatusCodes } from '../common/enums.ts';
import { PagedResult, Redirect, Resource, Result } from '../Resource.ts';
import { Accept, FromBody, FromQuery, FromRoute } from '../common/decorators.ts';
import { z } from 'zod';
import { NotFoundError, UnsupportedMediaTypeError } from '../common/errors.ts';
import { QueryBuilder, WithBuilder } from "../QueryBuilder.ts";

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
    return void Number();
  }
}

class TraceContextResource extends Resource {
  public GET() {
    return Result(
      HttpStatusCodes.Ok,
      this.context.var.traceparent
    );
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

const PAGED_DATA_LENGTH = 20
const PAGED_DATA = new Array(PAGED_DATA_LENGTH).fill(0).map((_, index) => {
  return {
    id: index,
    name: `demo-${index}`,
  };
});
class PageBuilder {
  #skip = MIN_SKIP;
  #take = MIN_TAKE;
  #orderBy: [string, 'ASC' | 'DESC'][] = [['id', 'ASC']];

  public orderBy(column: string, direction: 'ASC' | 'DESC' = 'ASC') {
    this.#orderBy.push([column, direction]);
    return this;
  }

  public skip(value: number) {
    this.#skip = value;
    return this;
  }

  public take(value: number) {
    this.#take = value;
    return this;
  }

  public getManyAndCount() {
    const result = this.#applyFilter(this.#applySort(PAGED_DATA));
    return Promise.resolve([result, PAGED_DATA_LENGTH] as const);
  }

  #applyFilter<T>(data: T[]) {
    return data
      .slice(this.#skip)
      .slice(Number(), this.#take);
  }

  #applySort<T extends Record<string, unknown>>(data: T[]) {
    return this.#orderBy.reduce((item, sort) => {
      return item.toSorted((a, b) => {
        const [column, order] = sort;
        const valA = a[column];
        const valB = b[column];

        // Handle null/undefined safely
        if (valA == null && valB == null) return 0;
        if (valA == null) return 1;
        if (valB == null) return -1;

        const bothNumbers = typeof valA === 'number' && typeof valB === 'number';
        const bothStrings = typeof valA === 'string' && typeof valB === 'string';

        let result: number;
        if (bothNumbers) {
          result = valA - valB;
        } else if (bothStrings) {
          result = valA.localeCompare(valB, undefined, { numeric: true });
        } else {
          // fallback: convert to string and compare
          result = String(valA)
            .localeCompare(
              String(valB),
              undefined,
              { numeric: true }
            );
        }

        return order === 'ASC' ? result : -result;
      });
    }, data);
  }
}

const MIN_SKIP = 0;
const MIN_TAKE = 10;
const MAX_TAKE = 50;
const BuilderSchema = z.array(
  z.union([
    z.tuple([
      z.literal('skip'),
      z.coerce
        .number()
        .min(MIN_SKIP)
    ]),
    z.tuple([
      z.literal('take'),
      z.coerce
        .number()
        .min(MIN_TAKE)
        .max(MAX_TAKE)
        .default(MAX_TAKE)
    ]),
    z.tuple([
      z.literal('orderBy'),
      z.string(),
      z.union([z.literal('DESC'), z.literal('ASC')]),
    ]),
  ])
);
class BuilderPagedResource extends Resource {
  async GET(@FromQuery(BuilderSchema) query: z.infer<typeof BuilderSchema>) {
    const result = await query
      .reduce(WithBuilder, new PageBuilder())
      .getManyAndCount();

    const params = query.reduce((result, param) => {
      const [key, ...args] = param;
      return result.set(key, args);
    }, new Map<string, any[]>());
    const take = params.get('take') ?? [MAX_TAKE];
    const skip = params.get('skip') ?? [MIN_SKIP];
    const orderBy = params.get('orderBy') ?? ['id', 'ASC'];
    const [_, count] = result;

    const previous = skip[0] - take[0] >= MIN_SKIP
      ? new QueryBuilder<PageBuilder>()
          .skip(Math.max(MIN_SKIP, skip[0] - take[0]))
          .take(take[0])
          .orderBy(orderBy[0], orderBy[1])
          .serialise()
      : undefined;

    const next = skip[0] + take[0] < count
      ? new QueryBuilder<PageBuilder>()
          .skip(Math.min(count, skip[0] + take[0]))
          .take(Math.min(take[0], count - skip[0]))
          .orderBy(orderBy[0], orderBy[1])
          .serialise()
      : undefined;

      return PagedResult(
      HttpStatusCodes.Ok,
      {
        meta: {
          url: this.request.url,
          pagination: {
            next,
            previous
          }
        },
        body: result,
      }
    );
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
const builderPagedResource = BuilderPagedResource.createClient(origin);
const traceContext = TraceContextResource.createClient(origin);

Application.instance.registerResources([
  RedirectResource,
  TestResource,
  UnsupportedContentResource,
  TraceContextResource,
  BuilderPagedResource
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
    id: Number(),
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

// Deno.test('ResourceClient adds trace context to fetch', async () => {
//   let traceparent = null;
//   traceContext.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
//     traceparent = new globalThis
//       .Headers(init?.headers)
//       .get(Headers.Traceparent);
//     return fetch(input, init);
//   };
//   const result = await traceContext.get();

//   expect(traceparent).toBe(`00-${result.traceId}-${result.parentId}-01`);
// });

Deno.test('ResourceClient handles pagination', async () => {
  const actualFirstPage = await new PageBuilder()
    .take(MIN_TAKE)
    .orderBy('name', 'DESC')
    .getManyAndCount();
  const actualSecondPage = await new PageBuilder()
    .skip(MIN_TAKE)
    .take(MIN_TAKE)
    .orderBy('name', 'DESC')
    .getManyAndCount();
  const firstPage = await builderPagedResource.get(
    new QueryBuilder<PageBuilder>()
      .take(MIN_TAKE)
      .orderBy('name', 'DESC')
      .serialise()
  );
  const secondPage = await builderPagedResource.next();
  const previousPage = await builderPagedResource.previous();

  expect(firstPage).toStrictEqual(actualFirstPage);
  expect(secondPage).toStrictEqual(actualSecondPage);
  expect(previousPage).toStrictEqual(actualFirstPage);
});