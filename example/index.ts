import { AsyncContextProvider, Application, AsyncLogger, AsyncConsoleLogService, AsyncLogService, type AsyncContextVariable } from '@resourceful-hono/core';
import BaseResource from './resources/BaseResource.ts';
import SSEResource from './resources/SSEResource.ts';
import JSONResource from './resources/JSONResource.ts';
import UserResource from './resources/UserResource.ts';
import RedirectResource from './resources/RedirectResource.ts';
import { AsyncLocalStorage } from 'node:async_hooks';
import { timing } from 'hono/timing';

class MyService {
  public [Symbol.dispose]() {
    return console.log('Dispose MyService');
  }
}
const app = Application.instance;
app.registerMiddlewares([AsyncContextProvider(AsyncLocalStorage), AsyncLogger, timing()]);
app.registerService(MyService, new MyService())
  .registerService(
    AsyncLogService,
    new AsyncConsoleLogService({
      current: {
        get context() {
          return app
            .getService(AsyncLocalStorage<AsyncContextVariable>)
            .getStore()!;
        },
      },
    })
  )
  .registerService(AsyncLocalStorage, new AsyncLocalStorage());

const origin = 'http://localhost:8000';
const jsonClient = JSONResource.createClient(origin);
const page = 10;
jsonClient.get({ id: '9491d710-3185-4e06-bea0-6a2f275345e0', name: 'nathan' }, { page });
jsonClient.put({ name: 'name', email: 'example@email.com', displayName: 'displayName' }, 'name');
jsonClient.post('1');
jsonClient.delete({ name: 'name', email: 'example@email.com', displayName: 'displayName' }, { page });
jsonClient.get({ name: 'nathan', id: '9491d710-3185-4e06-bea0-6a2f275345e0' }, { page });
const sseClient = SSEResource.createClient(origin);
sseClient.get().then(eventSource => {
  eventSource.addEventListener('hello', console.log);
});

app.registerResources([BaseResource, SSEResource, JSONResource, UserResource, RedirectResource]);

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