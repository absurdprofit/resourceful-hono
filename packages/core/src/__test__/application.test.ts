import { expect } from 'expect';
import { Application, Resource } from '../index.ts';
import { PromiseWrapper } from '../common/promise-wrapper.ts';
import { Hono } from 'hono';
import { honoBuilder } from '../common/utils.ts';

const promiseWrapper = new PromiseWrapper<void>();
Application.instance.addEventListener('ready', (e) => e.waitUntil(promiseWrapper.promise));
class DummyService {
  public value = true;
  public disposed = false;

  public [Symbol.dispose]() {
    this.disposed = true;
  }
}

class AsyncDummyService {
  public value = true;
  public disposed = false;

  public [Symbol.asyncDispose]() {
    return new Promise<void>(resolve => {
      this.disposed = true;
      resolve();
    });
  }
}

Deno.test('Application instance getter returns the same reference', () => {
  const instanceRef1 = Application.instance;
  const instanceRef2 = Application.instance;
  expect(instanceRef1).toBe(instanceRef2);
});

Deno.test('creating new Application instance throws an Error', () => {
  expect(() => {
    /* @ts-expect-error constructor is private */
    return new Application(crypto.randomUUID());
  }).toThrow(TypeError);
});

Deno.test('Registering a service with unrelated class throws', () => {
  const app = Application.instance;
  const service = new AsyncDummyService();

  expect(() => {
    app.registerService(DummyService, service as unknown as DummyService);
  }).toThrow(
    'Service DummyService should be initialised with an instance of DummyService.'
  );
});

Deno.test('Retrieving an unregistered service throws', () => {
  const app = Application.instance;
  
  expect(() => {
    app.getService(DummyService);
  }).toThrow(
    'Service DummyService not found.'
  );
});

Deno.test('Register and get service', () => {
  const app = Application.instance;
  const service = new DummyService();
  app.registerService(DummyService, service);
  const retrieved = app.getService(DummyService);
  expect(retrieved.value).toBeTruthy();
});

Deno.test('register resources with valid resource', () => {
  let constructed = false;
  // DummyResource extends Resource to pass the isResourceConstructor check.
  class DummyResource extends Resource {
    constructor(application: Application, Hono: typeof honoBuilder) {
      super(application, Hono);
      constructed = true;
    }
  }
  const app = Application.instance;
  app.registerResources([DummyResource]);
  expect(constructed).toBeTruthy();
});

Deno.test('register resources with invalid resource throws', () => {
  const app = Application.instance;
  const falseResource = '123';
  expect(() => {
    app.registerResources([falseResource as unknown as typeof Resource]);
  }).toThrow(TypeError);
});

Deno.test('state transitions from idle to ready and finally to finish and service disposed', async () => {
  const app = Application.instance;
  
  // resolve ready.waitUntil
  promiseWrapper.resolve();

  // Initially, state should be 'idle'.
  expect(app.state).toBe('idle');

  // Wait for the ready promise to resolve and update the state.
  await app.ready;
  expect(app.state).toBe('running');

  const service = new AsyncDummyService();
  app.registerService(AsyncDummyService, service);
  app.finish();
  await app.finished;
  expect(app.state).toBe('finished');
  expect(service.disposed).toBeTruthy();
});
