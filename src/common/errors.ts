import { HttpStatusCodes } from "./enums.ts";

export abstract class HttpError extends Error {
  public abstract readonly status: HttpStatusCodes;
  public get extensions(): object {
    return {};
  }
  public get type() {
    return `https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/${this.status}`;
  }
}

export class NotFoundError extends HttpError {
  public readonly status = HttpStatusCodes.NotFound;
  public override readonly name = 'NotFoundError';
}

export class ConflictError extends HttpError {
  public readonly status = HttpStatusCodes.Conflict;
  public override readonly name = 'ConflictError';
}

export class BadRequestError extends HttpError {
  public readonly status = HttpStatusCodes.BadRequest;
  public override readonly name = 'BadRequestError';
  public readonly issues: object[];

  constructor(message?: string, options?: ErrorOptions & { issues: object[] }) {
    super(message, options);
    this.issues = options?.issues ?? [];
  }

  public override get extensions() {
    return {
      issues: this.issues,
    };
  }
}

export class InternalServerError extends HttpError {
  public readonly status = HttpStatusCodes.InternalServerError;
  public override readonly name = 'InternalServerError';
}

export class UnauthorizedError extends HttpError {
  public readonly status = HttpStatusCodes.Unauthorized;
  public override readonly name = 'UnauthorizedError';
}

export class DependencyFailedError extends HttpError {
  public readonly status = HttpStatusCodes.DependencyFailed;
  public override readonly name = 'DependencyFailedError';
}

export class MethodNotAllowedError extends HttpError {
  public readonly status = HttpStatusCodes.MethodNotAllowed;
  public override readonly name = 'MethodNotAllowedError';
}

export class NotImplementedError extends Error {
  public readonly status = HttpStatusCodes.NotImplemented;
  public override readonly name = 'NotImplementedError';
}

export class ForbiddenError extends HttpError {
  public readonly status = HttpStatusCodes.Forbidden;
  public override readonly name = 'ForbiddenError';
}

export class UnsupportedMediaTypeError extends HttpError {
  public readonly status = HttpStatusCodes.UnsupportedMediaType;
  public override readonly name = 'UnsupportedMediaType';
}

export class SerialisableError extends Error {
  [key: string]: unknown;
  public readonly trace;
  constructor(error: Error) {
    super();
    /* eslint no-magic-numbers: ["error", { "ignore": [1] }] */
    this.trace = error.stack?.split('\n').splice(1).map(line => line.trim()) ?? [];
    delete error.stack;
    error.cause = error.cause instanceof Error ? new SerialisableError(error.cause) : error.cause;
    Object.getOwnPropertyNames(error).forEach(key => {
      if (key.startsWith('_')) return;
      Object.defineProperty(this, key, {
        enumerable: true,
        value: error[key as keyof Error],
      });
    });
  }

  public toJSON() {
    return { ...this };
  }
}