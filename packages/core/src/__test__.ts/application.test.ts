import { expect } from "jsr:@std/expect";
import { Application, Resource } from "../index.ts";

Deno.test("Application instance getter returns the same reference", () => {
  const instanceRef1 = Application.instance;
  const instanceRef2 = Application.instance;
  expect(instanceRef1).toBe(instanceRef2);
});

Deno.test("creating new Application instance throws an Error", () => {
  expect(() => {
    /* @ts-ignore */
    return new Application(crypto.randomUUID());
  }).toThrow(TypeError);
});

Deno.test("Register and get service", () => {
  class DummyService {
    value = true;
  }
  const app = Application.instance;
  const service = new DummyService();
  app.registerService(DummyService, service);
  const retrieved = app.getService(DummyService);
  expect(retrieved.value).toBeTruthy();
});

Deno.test("register resources with valid resource", () => {
  let constructed = false;
  // DummyResource extends Resource to pass the isResourceConstructor check.
  class DummyResource extends Resource {
    constructor() {
      super();
      constructed = true;
    }
  }
  const app = Application.instance;
  app.registerResources([DummyResource]);
  expect(constructed).toBeTruthy();
});

Deno.test("register resources with invalid resource throws", () => {
  const app = Application.instance;
  const falseResource = '123';
  expect(() => {
    app.registerResources([falseResource as unknown as typeof Resource]);
  }).toThrow(TypeError);
});

Deno.test("state transitions from idle to ready and finally to finish", async () => {
  const app = Application.instance;
  // Initially, state should be 'idle'.
  expect(app.state).toBe("idle");

  // Wait for the ready promise to resolve and update the state.
  await app.ready;
  expect(app.state).toBe("running");

  app.finish();
  await app.finished;
  expect(app.state).toBe("finished");
});