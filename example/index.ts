import { AppServer } from '@resourceful-hono/core';
import BaseResource from "./resources/BaseResource.ts";
import SSEResource from './resources/SSEResource.ts';

const appServer = AppServer.instance;
appServer.registerResources([BaseResource, SSEResource]);

appServer.addEventListener('ready', (e) => {
  e.waitUntil(new Promise((resolve) => setTimeout(resolve, 5000)));
});

appServer.ready.then(() => {
  console.log("Ready promise");
});

class MyService {
  [Symbol.asyncDispose]() {
    return new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

appServer.registerService(MyService, new MyService());

Deno.addSignalListener('SIGINT', () => {
  appServer.finish();
  appServer.finished.then(() => {
    console.log('Graceful shutdown');
    Deno.exit();
  });

});

export default {
  fetch: appServer.app.fetch
}