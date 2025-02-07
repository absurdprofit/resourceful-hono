import type { Context } from "jsr:@hono/hono@4.6.14";
import { Headers, HttpStatusCodes } from "../common/enums.ts";
import { type LogData, LogService } from "./LogService.ts";

enum StatusColour {
  REDIRECT = 'rgb(255, 255, 0)',
  ERROR = 'red',
  SUCCESS = 'rgb(0, 255, 25)'
}

export class ConsoleLogService extends LogService {
  public debug(message: string, data: LogData = {}) {
    const { context, payload } = data;
    if (context) this.printAccessLog(context);
    return console.debug(message, payload ?? '');
  }

  public info(message: string, data: LogData = {}) {
    const { context, payload } = data;
    if (context) this.printAccessLog(context);
    return console.info(message, payload ?? '');
  }

  public warn(message: string, error?: Error | null, data: LogData = {}) {
    const { context, payload } = data;
    if (context) this.printAccessLog(context);
    return console.warn(message, error, payload ?? '');
  }

  public error(error: Error, data: LogData = {}) {
    const { context, payload } = data;
    if (context) this.printAccessLog(context);
    return console.error(error, payload ?? '');
  }

  private printAccessLog(context: Context) {
    const responseTimeMs = ` | ${context.res.headers.get(Headers.ResponseTime)}ms`;
    const userAgent = ` | ${context.req.header(Headers.UserAgent)}`;
    const log = `[${context.req.method} %c${context.res.status}%c] ${context.req.url} - ${new Date().toUTCString()}${userAgent}${responseTimeMs}\n`;
    let statusColour;
    if (context.res.status < HttpStatusCodes.MultipleChoices) {
      statusColour = StatusColour.SUCCESS;
    } else if (context.res.status < HttpStatusCodes.BadRequest) {
      statusColour = StatusColour.REDIRECT;
    } else {
      statusColour = StatusColour.ERROR;
    }
    console.log(log, `color: ${statusColour}`, 'color: white');
  }
}