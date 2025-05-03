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
    get context(): AsyncContextVariable<{ logs?: Log[] } & TimingVariables>;
  };
}

export class AsyncConsoleLogService extends AsyncLogService {
  private readonly ref: Ref;

  constructor(ref: Ref) {
    super();
    this.ref = ref;
  }

  private get logs(): Log[] {
    let store = this.ref.current.context.get('logs');
    if (!store) {
      store = [];
      this.ref.current.context.set('logs', store);
    }
    return store;
  }

  public debug(message: string, data: AsyncLogData = {}): void {
    const { payload = '' } = data;
    this.logs.push({
      type: 'debug',
      data: [message, payload],
    });
  }

  public info(message: string, data: AsyncLogData = {}): void {
    const { payload = '' } = data;
    this.logs.push({
      type: 'info',
      data: [message, payload],
    });
  }

  public warn(message: string, error?: Error | null, data: AsyncLogData = {}): void {
    const { payload = '' } = data;
    this.logs.push({
      type: 'warn',
      data: [message, error, payload],
    });
  }

  public error(error: Error, data: AsyncLogData = {}): void {
    const { payload = '' } = data;
    this.logs.push({
      type: 'error',
      data: [error, payload],
    });
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

  public flush() {
    const { context } = this.ref.current;
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