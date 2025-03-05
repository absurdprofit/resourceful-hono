import { assertSpyCall, spy } from 'mock';
import { ConsoleLogService } from '../LogService/index.ts';
import { Headers, HttpStatusCodes } from '../common/enums.ts';
import type { Context } from 'hono';

// 🟢 Debug Log Test
Deno.test('ConsoleLogService should log debug messages', () => {
  const debug = spy(console, 'debug');
  const logger = new ConsoleLogService();
  const message = 'Debug message';
  const payload = { some: 'data' };
  
  logger.debug(message);
  logger.debug(message, { payload });

  assertSpyCall(debug, 0, { args: [message, undefined] });
  assertSpyCall(debug, 1, { args: [message, payload] });
});

// 🔵 Info Log Test
Deno.test('ConsoleLogService should log info messages', () => {
  const info = spy(console, 'info');
  const logger = new ConsoleLogService();
  const message = 'Info message';
  const payload = { some: 'data' };

  logger.info(message);
  logger.info(message, { payload });

  assertSpyCall(info, 0, { args: [message, undefined] });
  assertSpyCall(info, 1, { args: [message, payload] });
});

// 🟠 Warning Log Test
Deno.test('ConsoleLogService should log warnings', () => {
  const warn = spy(console, 'warn');
  const logger = new ConsoleLogService();
  const message = 'Warning message';
  const error = new Error('Test warning');
  const payload = { warning: 'something went wrong' };

  logger.warn(message, error);
  logger.warn(message, error, { payload });

  assertSpyCall(warn, 0, { args: [message, error, undefined] });
  assertSpyCall(warn, 1, { args: [message, error, payload] });
});

// 🔴 Error Log Test
Deno.test('ConsoleLogService should log errors', () => {
  const errorLog = spy(console, 'error');
  const logger = new ConsoleLogService();
  const error = new Error('Test error');
  const payload = { error: 'critical failure' };

  logger.error(error);
  logger.error(error, { payload });

  assertSpyCall(errorLog, 0, { args: [error, undefined] });
  assertSpyCall(errorLog, 1, { args: [error, payload] });
});

// 📄 Access Log Test
Deno.test('ConsoleLogService should log access logs correctly', () => {
  const log = spy(console, 'log');
  const logger = new ConsoleLogService();
  const date = new Date().toUTCString();

  const mockContext = {
    req: {
      method: 'GET',
      url: 'http://localhost:3000/api/test?param=value',
      header: (name: string) => (name === Headers.UserAgent ? 'MockUserAgent' : null),
    },
    res: {
      status: HttpStatusCodes.PermanentRedirect,
      headers: new globalThis.Headers({
        [Headers.Date]: date,
        [Headers.Location]: '/redirect'
      }),
    },
    get: (key: string) => (key === 'metric' ? { headers: ['total;dur=12.5'] } : null),
  } as unknown as Context;

  logger.debug('Request processed', { context: mockContext });

  const args = [
    `[GET %c${HttpStatusCodes.PermanentRedirect}%c] http://localhost:3000%c/api/test%c?param=value %c- ${date} | MockUserAgent | 12.5ms`,
    'color: rgb(255, 255, 0)',
    'color: white',
    'color: rgb(244, 188, 0)',
    'color: lightblue',
    'color: white',
  ];
  assertSpyCall(log, 0, { args });
});