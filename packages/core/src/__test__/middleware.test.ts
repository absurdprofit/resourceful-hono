import { endTime, setMetric, startTime } from 'hono/timing';
import { Application } from '../Application.ts';
import { Logger } from '../middleware/Logger.ts';
import { Resource } from '../Resource.ts';
import { ConsoleLogService, LogService } from '../services/LogService/index.ts';
import { HttpStatusCodes } from '../common/enums.ts';
import { expect } from 'expect';
import { TransactionScope } from '../index.ts';
import { DependencyFailedError, InternalServerError, NotFoundError } from '../common/errors.ts';

const app = Application.instance;
app.registerMiddlewares([Logger]);
app.registerService(LogService, new ConsoleLogService());

class TestResource extends Resource {
  public async GET() {
    const timeout = 10;
    startTime(this.context, 'test');
    await new Promise(resolve => setTimeout(resolve, timeout));
    endTime(this.context, 'test');

    setMetric(this.context, 'test2');
  }

  public async POST() {
    const commit = () => {};
    const rollback = () => {};
    await using _scope = new TransactionScope({ commit, rollback });

    throw new DependencyFailedError();
  }

  public PUT() {
    throw new Error('Test error');
  }

  public async PATCH() {
    const commit = () => {};
    const rollback = () => {};
    
    await using _scope = new TransactionScope({ commit, rollback });
  }

  public DELETE() {
    return void Number();
  }
}

app.registerResources([
  TestResource,
]);

Deno.test('ErrorHandler throws user error in TransactionScope', async () => {
  const response = await app.hono.request('test', { method: 'POST' });

  const error = await response.json();
  expect(response.status).toEqual(HttpStatusCodes.DependencyFailed);
  expect(error.title).toEqual(DependencyFailedError.name);
});

Deno.test('ErrorHandler wraps arbitrary errors with InternalServerError', async () => {
  const response = await app.hono.request('test', { method: 'PUT' });

  const error = await response.json();
  expect(response.status).toEqual(HttpStatusCodes.InternalServerError);
  expect(error.title).toEqual(InternalServerError.name);
});

Deno.test('ErrorHandler wraps RollbackError with InternalServerError', async () => {
  const response = await app.hono.request('test', { method: 'PATCH' });

  const error = await response.json();
  expect(response.status).toEqual(HttpStatusCodes.InternalServerError);
  expect(error.title).toEqual(InternalServerError.name);
});

Deno.test('NotFoundHandler adds 404 response', async () => {
  const response = await app.hono.request('secondtest');

  const error = await response.json();
  expect(response.status).toEqual(HttpStatusCodes.NotFound);
  expect(error.title).toEqual(NotFoundError.name);
});
