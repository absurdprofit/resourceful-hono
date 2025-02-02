import { Application } from '@resourceful-hono/core';
import BaseResource from "./resources/BaseResource.ts";
import SSEResource from './resources/SSEResource.ts';
import JSONResource from "./resources/JSONResource.ts";
import UserResource from "./resources/UserResource.ts";
import RedirectResource from "./resources/RedirectResource.ts";

const origin = 'http://localhost:8000';
const jsonClient = JSONResource.createClient(origin);
jsonClient.GET({ id: '9491d710-3185-4e06-bea0-6a2f275345e0', name: 'nathan' }, { page: 10 }).then(console.log);
jsonClient.put({ name: 'name', email: 'email', displayName: 'displayName' }, 'name');
jsonClient.post('1', 2);
jsonClient.delete({ name: 'name', email: 'email', displayName: 'displayName' }, { page: 10 });
// jsonClient.get('nathan', 1).then(console.log);
// const sseClient = SSEResource.createClient(origin);
// sseClient.get().then(eventSource => {
//   eventSource.addEventListener('hello', console.log);
// });
// const redirectClient = RedirectResource.createClient(origin);
// redirectClient.get().then(console.log);
// // redirectClient.patch().then(console.log);
// // redirectClient.post().then(console.log);
// // redirectClient.delete().then(console.log);


const app = Application.instance;
app.registerResources([BaseResource, SSEResource, JSONResource, UserResource, RedirectResource]);

app.addEventListener('ready', (e) => {
  // e.waitUntil(new Promise((resolve) => setTimeout(resolve, 5000)));
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