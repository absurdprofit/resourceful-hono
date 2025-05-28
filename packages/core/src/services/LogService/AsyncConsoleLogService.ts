import { Headers, HttpStatusCodes } from '../../common/enums.ts';
import { type AsyncLogData, AsyncLogService } from './AsyncLogService.ts';
import type { TimingVariables } from 'hono/timing';
import { parseTotalDuration } from '../../common/utils.ts';
import type { AsyncContextVariable } from '../../middleware/index.ts';
import { StatusColour } from './common/enums.ts';

interface Log {
  type: 'debug' | 'warn' | 'info' | 'error';
  data: unknown[];
}

interface Ref {
  current: {
    get context(): AsyncContextVariable<{ logs?: Log[] } & TimingVariables> | null;
  };
}

export class AsyncConsoleLogService extends AsyncLogService {
  private readonly ref: Ref;

  constructor(ref: Ref) {
    super();
    this.ref = ref;
  }

  private get logs(): Log[] {
    let store = this.ref.current.context?.get('logs');
    if (!store) {
      store = [];
      this.ref.current.context?.set('logs', store);
    }
    return store;
  }

  public debug(message: string, data: AsyncLogData = {}): void {
    const { payload = '' } = data;
    const log: Log = {
      type: 'debug',
      data: [message, payload],
    };
    if (this.ref.current)
      return this.logImmediate(log);
    this.logs.push(log);
  }

  public info(message: string, data: AsyncLogData = {}): void {
    const { payload = '' } = data;
    const log: Log = {
      type: 'info',
      data: [message, payload],
    };
    if (this.ref.current)
      return this.logImmediate(log);
    this.logs.push(log);
  }

  public warn(message: string, error?: Error | null, data: AsyncLogData = {}): void {
    const { payload = '' } = data;
    const log: Log = {
      type: 'warn',
      data: [message, error, payload],
    };
    if (this.ref.current)
      return this.logImmediate(log);
    this.logs.push(log);
  }

  public error(error: Error, data: AsyncLogData = {}): void {
    const { payload = '' } = data;
    const log: Log = {
      type: 'error',
      data: [error, payload],
    };
    if (this.ref.current)
      return this.logImmediate(log);
    this.logs.push();
  }

  private createAccessLog(context: AsyncContextVariable<TimingVariables>) {
    const responseTimeMs = `${parseTotalDuration(context.get('metric')?.headers ?? [])}ms`;
    const userAgent = context.request.headers.get(Headers.UserAgent);
    const date = context.response.headers.get(Headers.Date);
    const { origin, pathname, search } = new URL(context.request.url);
    const log = `[${context.request.method} %c${context.response.status}%c] ${[origin, pathname, search].join('%c')} %c- ${[date, userAgent, responseTimeMs].join(' | ')}`;
    let statusColour;
    if (context.response.status < HttpStatusCodes.MultipleChoices) {
      statusColour = StatusColour.SUCCESS;
    } else if (context.response.status < HttpStatusCodes.BadRequest) {
      statusColour = StatusColour.REDIRECT;
    } else {
      statusColour = StatusColour.ERROR;
    }
    return [log, `color: ${statusColour}`, 'color: white', 'color: rgb(244, 188, 0)', 'color: lightblue', 'color: white'];
  }

  public logImmediate(log: Log) {
    console[log.type](...log.data);
  }

  public flush() {
    const { context } = this.ref.current;
    if (!context)
      throw new ReferenceError('AsyncContext is unavailable. Is the AsyncContextProvider middleware registered?');
    const logs = this.logs;
    if (logs) {
      console.group(...this.createAccessLog(context));
      for (const log of logs) {
        console[log.type](...log.data);
      }
      console.groupEnd();
    } else {
      console.log(this.createAccessLog(context));
    }
  }
}