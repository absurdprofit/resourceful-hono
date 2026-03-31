import { Headers, HttpStatusCodes } from '../../common/enums.ts';
import { type LogData, LogService } from './LogService.ts';
import { parseTotalDuration } from '../../common/utils.ts';
import { StatusColour } from './common/enums.ts';
import { Application, type ResponseEvent } from '@resourceful-hono/core';

interface Log {
  type: 'debug' | 'warn' | 'info' | 'error';
  data: unknown[];
}

export class AsyncConsoleLogService extends LogService {
  constructor() {
    super();
    Application.instance.addEventListener('response', this);
    Application.instance.addEventListener('error', this);
  }

  public handleEvent(event: Event) {
    switch (event.type) {
      case 'response': {
        const { context } = event as ResponseEvent;
        this.flush(context);
        break;
      }
      case 'error': {
        const { error } = event as ErrorEvent;
        this.error(error);
        break;
      }
    }
  }

  private get logs() {
    const { context } = Application.instance;
    let store = context?.get('logs');
    if (!store) {
      store = [];
      context?.set('logs', store);
    }
    return store as Log[];
  }

  public debug(message: string, data: LogData = {}): void {
    const { payload = '' } = data;
    const log: Log = {
      type: 'debug',
      data: [message, payload],
    };
    const { context } = Application.instance;
    if (!context)
      return this.logImmediate(log);
    this.logs.push(log);
  }

  public info(message: string, data: LogData = {}): void {
    const { payload = '' } = data;
    const log: Log = {
      type: 'info',
      data: [message, payload],
    };
    const { context } = Application.instance;
    if (!context)
      return this.logImmediate(log);
    this.logs.push(log);
  }

  public warn(message: string, error?: Error | null, data: LogData = {}): void {
    const { payload = '' } = data;
    const log: Log = {
      type: 'warn',
      data: [message, error, payload],
    };
    const { context } = Application.instance;
    if (!context)
      return this.logImmediate(log);
    this.logs.push(log);
  }

  public error(error: Error, data: LogData = {}): void {
    const { payload = '' } = data;
    const log: Log = {
      type: 'error',
      data: [error, payload],
    };
    const { context } = Application.instance;
    if (!context)
      return this.logImmediate(log);
    this.logs.push();
  }

  private createAccessLog(context: ResponseEvent['context']) {
    const responseTimeMs = `${parseTotalDuration(context.get('metric')?.headers ?? [])}ms`;
    const userAgent = context.req.raw.headers.get(Headers.UserAgent);
    const date = context.res.headers.get(Headers.Date);
    const { origin, pathname, search } = new URL(context.req.url);
    const log = `[${context.req.method} %c${context.res.status}%c] ${[origin, pathname, search].join('%c')} %c- ${[date, userAgent, responseTimeMs].join(' | ')}`;
    let statusColour;
    if (context.res.status < HttpStatusCodes.MultipleChoices) {
      statusColour = StatusColour.SUCCESS;
    } else if (context.res.status < HttpStatusCodes.BadRequest) {
      statusColour = StatusColour.REDIRECT;
    } else {
      statusColour = StatusColour.ERROR;
    }
    return [log, `color: ${statusColour}`, 'color: white', 'color: rgb(244, 188, 0)', 'color: lightblue', 'color: white'];
  }

  public logImmediate(log: Log) {
    console[log.type](...log.data);
  }

  public flush(context: ResponseEvent['context']) {
    // if (!context)
    //   throw new ReferenceError('AsyncContext is unavailable. Is the AsyncContextProvider middleware registered?');
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

  public [Symbol.dispose]() {
    Application.instance.removeEventListener('response', this);
    Application.instance.removeEventListener('error', this);
  }
}