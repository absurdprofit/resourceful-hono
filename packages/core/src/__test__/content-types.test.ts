import { expect } from 'expect';
import { EventSource } from 'eventsource';
import { ContentTypeRegistry } from '../ContentTypeRegistry.ts';
import { ContentTypes, Headers } from '../common/enums.ts';
import { NotFoundError } from '../common/errors.ts';
import { HttpError } from '../HttpError.ts';
import { ServerSentEvent } from '../index.ts';

Deno.test('Case insensitive matching', () => {
  const registry = ContentTypeRegistry.default;
  const handler = registry.get('*', 'APPLICATION/JSON');
  expect(handler).toBeDefined();
});

Deno.test('Matching ignoring directive', () => {
  const registry = ContentTypeRegistry.default;
  const textPlainWithDirective = 'text/plain; charset=utf-8';
  const handler = registry.get('*', textPlainWithDirective);
  expect(handler).toBeDefined();
});

// Test 3: Normal content type matching
Deno.test('Normal content type matching', () => {
  const registry = ContentTypeRegistry.default;
  const handler = registry.get('*', ContentTypes.PlainText);
  expect(handler).toBeDefined();
});

const defaultRegistry = ContentTypeRegistry.default;

// JSON Handler Test
Deno.test('JSON handler works', async () => {
  const handler = defaultRegistry.get('*', ContentTypes.Json);
  expect(handler).toBeDefined();
  const data = { message: 'hello' };

  const encoded = await handler?.encode(data);
  expect(encoded).toBe(JSON.stringify(data));

  const response = Response.json(data);
  const decoded = await handler?.decode(response);
  expect(decoded).toEqual(data);
});

// ProblemDetails Handler Test
Deno.test('ProblemDetails handler works', async () => {
  const handler = defaultRegistry.get('*', ContentTypes.ProblemDetails);
  expect(handler).toBeDefined();
  const data = new NotFoundError('404 Not Found');

  const encoded = await handler?.encode(data);
  expect(encoded).toBe(JSON.stringify(data));

  const response = new Response(encoded, {
    headers: {
      [Headers.ContentType]: ContentTypes.ProblemDetails,
    },
  });
  const decoded = await handler?.decode(response);
  expect(HttpError[Symbol.hasInstance](decoded)).toBe(true);
  expect(decoded).toEqual(data);
});

// FormUrlEncoded / MultipartFormData Handler Test
Deno.test('Form data handler works', async () => {
  // This handler is registered for both FormUrlEncoded and MultipartFormData.
  const handler = defaultRegistry.get('*', ContentTypes.FormUrlEncoded);
  expect(handler).toBeDefined();
  const data = { message: 'hello', array: ['1', '2', '3'] };

  const encoded = await handler?.encode(data);
  expect(encoded).toBeInstanceOf(FormData);
  expect((encoded as FormData).get('message')).toBe(data.message);
  expect((encoded as FormData).getAll('array')).toStrictEqual(data.array);

  const response = new Response(encoded);
  const decoded = await handler?.decode(response);
  expect(decoded).toStrictEqual(data);
});

// PlainText Handler Test
Deno.test('PlainText handler works', async () => {
  const handler = defaultRegistry.get('*', ContentTypes.PlainText);
  expect(handler).toBeDefined();
  const data = 'hello world';

  const encoded = await handler?.encode(data);
  expect(encoded).toBe(String(data));

  const response = new Response(encoded);
  const decoded = await handler?.decode(response);
  expect(decoded).toBe(data);
});


// ServerSentEvent  Handler Tests
Deno.test('ServerSentEvent handler works', async () => {
  const handler = defaultRegistry.get('*', ContentTypes.ServerSentEvent);
  expect(handler).toBeDefined();

  const headers = new globalThis.Headers();
  headers.set(Headers.ContentType, ContentTypes.ServerSentEvent);
  headers.set(Headers.CacheControl, 'no-cache');
  headers.set(Headers.Connection, 'keep-alive');
  const id = 1;
  // decode response
  {
    const data = function* () {
      yield new ServerSentEvent(
        'message',
        {
          comment: 'comment',
          data: 'some data',
          id,
        }
      );
    };
    const encoded = await handler?.encode(data, ContentTypes.ServerSentEvent);
    expect(encoded).toBeInstanceOf(ReadableStream);
    const response = new Response(encoded, { headers });
    Object.defineProperty(response, 'url', {
      get: () => 'http://localhost:80/',
    });
    const decoded = await handler?.decode(response);
    expect(decoded).toBeInstanceOf(EventSource);
    const event = await new Promise<MessageEvent>(resolve => {
      (decoded as EventSource).onmessage = resolve;  
    });
    expect(event.type).toBe('message');
    expect(event.data).toBe('some data');
    expect(event.lastEventId).toBe('1');
    (decoded as EventSource).close();
  }
  // decode request
  {
    const data = function* () {
      yield new ServerSentEvent(
        'message',
        {
          comment: 'comment',
          data: { some: 'data' },
          id,
        }
      );
    };
    const encoded = await handler?.encode(data, ContentTypes.ServerSentEvent);
    expect(encoded).toBeInstanceOf(ReadableStream);
    const method = 'POST';
    const body = encoded;
    const request = new Request(
      'http://localhost:80/',
      { body , method, headers }
    );
    const decoded = await handler?.decode(request);
    expect(decoded).toBeInstanceOf(EventSource);
    const event = await new Promise<MessageEvent>(resolve => {
      (decoded as EventSource).onmessage = resolve;  
    });
    expect(event.type).toBe('message');
    expect(event.data).toBe('{"some":"data"}');
    expect(event.lastEventId).toBe('1');
    (decoded as EventSource).close();
  }
});

Deno.test('OctetStream handler works', async () => {
  const handler = defaultRegistry.get('*', ContentTypes.OctetStream);
  expect(handler).toBeDefined();

  const stream = new ReadableStream();
  const encoded = await handler?.encode(stream);
  const response = new Response(encoded);
  const decoded = await handler?.decode(response);

  expect(encoded).toBe(stream);
  expect(decoded).toBe(response.body);
});

Deno.test('Stream encoder throws if given non-iterable', () => {
  const handler = defaultRegistry.get('*', ContentTypes.OctetStream);
  expect(handler).toBeDefined();

  expect(() => {
    handler?.encode('data');
  }).toThrow(
    'Only generators or ReadableStreams can be turned into Resource streams'
  );
});