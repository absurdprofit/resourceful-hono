import { Application, Logger, ConsoleLogService, LogService } from '@resourceful-hono/core';
import BaseResource from "./resources/BaseResource.ts";
import SSEResource from './resources/SSEResource.ts';
import JSONResource from "./resources/JSONResource.ts";
import UserResource from "./resources/UserResource.ts";
import RedirectResource from "./resources/RedirectResource.ts";

class MyService {
  [Symbol.asyncDispose]() {
    return new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
const app = Application.instance;
app.registerMiddlewares([Logger]);
app.registerService(MyService, new MyService())
  .registerService(LogService, new ConsoleLogService());

const origin = 'http://localhost:8000';
const jsonClient = JSONResource.createClient(origin);
jsonClient.get({ id: '9491d710-3185-4e06-bea0-6a2f275345e0', name: 'nathan' }, { page: 10 }).then(console.log).catch(console.error);
// jsonClient.put({ name: 'name', email: 'example@email.com', displayName: 'displayName' }, 'name').catch(console.error);
// jsonClient.post('1').catch(console.error);
// jsonClient.delete({ name: 'name', email: 'example@email.com', displayName: 'displayName' }, { page: 10 }).catch(console.error);
// jsonClient.get({ name: 'nathan', id: "9491d710-3185-4e06-bea0-6a2f275345e0" }, { page: 10 }).then(console.log).catch(console.error);
// const sseClient = SSEResource.createClient(origin);
// sseClient.get().then(eventSource => {
//   eventSource.addEventListener('hello', console.log);
// }).catch(console.error);

app.registerResources([BaseResource, SSEResource, JSONResource, UserResource, RedirectResource]);

app.addEventListener('ready', (e) => {
  // e.waitUntil(new Promise((resolve) => setTimeout(resolve, 5000)));
});

app.ready.then(() => {
  console.log("Ready promise");
});

// Deno.addSignalListener('SIGINT', () => {
//   app.finish();
//   app.finished.then(() => {
//     console.log('Graceful shutdown');
//     Deno.exit();
//   });
// });

export default {
  fetch: app.fetch
}