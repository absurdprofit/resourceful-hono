import { Application } from '@resourceful-hono/core';
import BaseResource from "./resources/BaseResource.ts";
import SSEResource from './resources/SSEResource.ts';
import JSONResource from "./resources/JSONResource.ts";
import UserResource from "./resources/UserResource.ts";

const app = Application.instance;
app.registerResources([BaseResource, SSEResource, JSONResource, UserResource]);

app.addEventListener('ready', (e) => {
  e.waitUntil(new Promise((resolve) => setTimeout(resolve, 5000)));
});

app.ready.then(() => {
  console.log("Ready promise");
});

class MyService {
  [Symbol.asyncDispose]() {
    return new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

app.registerService(MyService, new MyService());

Deno.addSignalListener('SIGINT', () => {
  app.finish();
  app.finished.then(() => {
    console.log('Graceful shutdown');
    Deno.exit();
  });

});

export default {
  fetch: app.fetch
}