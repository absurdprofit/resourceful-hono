import type { Context } from 'hono';
import { Headers, HttpStatusCodes } from '../common/enums.ts';
import { type LogData, LogService } from './LogService.ts';
import type { TimingVariables } from 'hono/timing';
import { parseTotalDuration } from '../common/utils.ts';

enum StatusColour {
  REDIRECT = 'rgb(255, 255, 0)',
  ERROR = 'red',
  SUCCESS = 'rgb(0, 255, 25)'
}

export class ConsoleLogService extends LogService {
  public debug(message: string, data: LogData = {}): void {
    const { context, payload = '' } = data;
    if (context) this.printAccessLog(context);
    return console.debug(message, payload);
  }

  public info(message: string, data: LogData = {}): void {
    const { context, payload = '' } = data;
    if (context) this.printAccessLog(context);
    return console.info(message, payload);
  }

  public warn(message: string, error?: Error | null, data: LogData = {}): void {
    const { context, payload = '' } = data;
    if (context) this.printAccessLog(context);
    return console.warn(message, error, payload);
  }

  public error(error: Error, data: LogData = {}): void {
    const { context, payload = '' } = data;
    if (context) this.printAccessLog(context);
    return console.error(error, payload);
  }

  private printAccessLog(context: Context<{ Variables: TimingVariables }>) {
    const responseTimeMs = `${parseTotalDuration(context.get('metric')?.headers ?? [])}ms`;
    const userAgent = context.req.header(Headers.UserAgent);
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
    console.log(log, `color: ${statusColour}`, 'color: white', 'color: rgb(244, 188, 0)', 'color: lightblue', 'color: white');
  }
}