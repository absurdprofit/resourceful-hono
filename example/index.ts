import { AsyncContextProvider, Application, AsyncConsoleLogService, LogService, QueryBuilder } from '@resourceful-hono/core';
import BaseResource from './resources/BaseResource.ts';
import SSEResource from './resources/SSEResource.ts';
import JSONResource from './resources/JSONResource.ts';
import UserResource from './resources/UserResource.ts';
import RedirectResource from './resources/RedirectResource.ts';
import { AsyncLocalStorage } from 'node:async_hooks';
import { timing } from 'hono/timing';
import { PagedResource, PageBuilder } from './resources/PagedResource.ts';

class MyService {
  public [Symbol.dispose]() {
    return console.log('Dispose MyService');
  }
}
const app = Application.instance;
app.registerMiddlewares([AsyncContextProvider(), timing()]);
app.registerService(MyService, new MyService())
  .registerService(
    LogService,
    new AsyncConsoleLogService()
  )
  .registerService(AsyncLocalStorage, new AsyncLocalStorage());

const origin = 'http://localhost:8000';
const jsonClient = JSONResource.createClient(origin);
const page = 8;
jsonClient.get({ id: '9491d710-3185-4e06-bea0-6a2f275345e0', name: 'nathan' }, { page });
jsonClient.put({ name: 'name', email: 'example@email.com', displayName: 'displayName' }, 'name');
jsonClient.post('1');
jsonClient.delete({ name: 'name', email: 'example@email.com', displayName: 'displayName' }, { page });
jsonClient.get({ name: 'nathan', id: '9491d710-3185-4e06-bea0-6a2f275345e0' }, { page });
const sseClient = SSEResource.createClient(origin);
sseClient.get().then(eventSource => {
  eventSource.addEventListener('hello', console.log);
});
const pagedClient = PagedResource.createClient('http://localhost:8000');
const skip = 5;
const take = 10;
const query = new QueryBuilder<PageBuilder>()
  .leftJoinAndSelect('user.photos', 'photo')
  .skip(skip)
  .take(take)
  .serialise();
pagedClient.get(query).then((result) => {
  console.log(result);
  return pagedClient.next();
})
  .then(console.log);

app.registerResources([BaseResource, PagedResource, SSEResource, JSONResource, UserResource, RedirectResource]);

app.ready.then(() => {
  console.log('Ready promise');
});

// Deno.addSignalListener('SIGINT', () => {
//   app.finish();
//   app.finished.then(() => {
//     console.log('Graceful shutdown');
//     Deno.exit();
//   });
// });

export default {
  fetch: app.fetch,
};