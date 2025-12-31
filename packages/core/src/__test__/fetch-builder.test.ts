import { expect } from 'expect';
import { stub } from 'mock';
import { FetchBuilder } from '../FetchBuilder.ts';

Deno.test('middlewares run in sequence (request + response)', async () => {
  const log: string[] = [];

  const fetchStub = stub(
    globalThis,
    'fetch',
    () => {
      log.push('fetch');
      return Promise.resolve(new Response('ok'));
    }
  );

  try {
    const builder = new FetchBuilder()
      .with(() => {
        log.push('mw1:request');
        return (res) => {
          log.push('mw1:response');
          return res;
        };
      })
      .with(() => {
        log.push('mw2:request');
        return (res) => {
          log.push('mw2:response');
          return res;
        };
      });

    const fetchFn = builder.build();
    await fetchFn('https://example.com');

    expect(log).toEqual([
      'mw1:request',
      'mw2:request',
      'fetch',
      'mw1:response',
      'mw2:response',
    ]);
  } finally {
    fetchStub.restore();
  }
});

Deno.test('response handlers run strictly in registration order', async () => {
  const log: `${number}`[] = [];

  const fetchStub = stub(
    globalThis,
    'fetch',
    () => Promise.resolve(new Response('ok'))
  );

  try {
    const builder = new FetchBuilder()
      .with(() => (res) => {
        log.push('1');
        return res;
      })
      .with(() => (res) => {
        log.push('2');
        return res;
      })
      .with(() => (res) => {
        log.push('3');
        return res;
      });

    await builder.build()('https://example.com');

    expect(log).toEqual(['1', '2', '3']);
  } finally {
    fetchStub.restore();
  }
});

Deno.test('build() is idempotent (no middleware duplication)', async () => {
  const log: string[] = [];

  const fetchStub = stub(
    globalThis,
    'fetch',
    () => Promise.resolve(new Response('ok'))
  );

  try {
    const builder = new FetchBuilder().with(() => {
      log.push('mw');
      return undefined;
    });

    const fetchA = builder.build();
    const fetchB = builder.build();

    await fetchA('https://a.example');
    await fetchB('https://b.example');

    expect(log).toEqual(['mw', 'mw']);
  } finally {
    fetchStub.restore();
  }
});

Deno.test('multiple fetch calls reuse the same middleware set', async () => {
  const log: `${number}`[] = [];

  const fetchStub = stub(
    globalThis,
    'fetch',
    () => Promise.resolve(new Response('ok'))
  );

  try {
    const fetchFn = new FetchBuilder()
      .with(() => {
        log.push('1');
        return undefined;
      })
      .with(() => {
        log.push('2');
        return undefined;
      })
      .build();

    await fetchFn('https://example.com/1');
    await fetchFn('https://example.com/2');

    expect(log).toEqual(['1', '2', '1', '2']);
  } finally {
    fetchStub.restore();
  }
});
