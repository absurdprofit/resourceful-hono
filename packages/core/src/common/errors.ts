import { HttpError } from '../HttpError.ts';
import { HttpStatusCodes } from './enums.ts';

export class GenericHttpError extends HttpError {
  public override readonly status: number;
  public override type: string;
  public override title: string;
  [key: string]: unknown;
  constructor(details: { [P in keyof Omit<HttpError, keyof Error>]: Omit<HttpError, keyof Error>[P] }) {
    const { detail, status, title, type, ...rest } = details;
    super(detail);
    this.status = status;
    this.type = type;
    this.title = title;
    this.name = title;

    Object.entries(rest).forEach(([key, value]) => {
      this[key] = value;
    });
  }
}

export class NotFoundError extends HttpError {
  public override readonly status = HttpStatusCodes.NotFound;
  public override readonly type: string = `https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/${this.status}`;
}

export class ConflictError extends HttpError {
  public override readonly status = HttpStatusCodes.Conflict;
  public override readonly type: string = `https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/${this.status}`;
}

interface BadRequestErrorOptions extends ErrorOptions {
  issues: object[];
}

export class BadRequestError extends HttpError {
  public override readonly status = HttpStatusCodes.BadRequest;
  public override readonly type: string = `https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/${this.status}`;
  public readonly issues: object[];

  constructor(
    message?: string,
    options: BadRequestErrorOptions = { issues: [] }
  ) {
    super(message, options);
    this.issues = options.issues;
  }
}

export class InternalServerError extends HttpError {
  public override readonly status = HttpStatusCodes.InternalServerError;
  public override readonly type: string = `https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/${this.status}`;
}

export class UnauthorizedError extends HttpError {
  public override readonly status = HttpStatusCodes.Unauthorized;
  public override readonly type: string = `https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/${this.status}`;
}

export class DependencyFailedError extends HttpError {
  public override readonly status = HttpStatusCodes.DependencyFailed;
  public override readonly type: string = `https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/${this.status}`;
}

export class MethodNotAllowedError extends HttpError {
  public override readonly status = HttpStatusCodes.MethodNotAllowed;
  public override readonly type: string = `https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/${this.status}`;
}

export class NotImplementedError extends HttpError {
  public override readonly status = HttpStatusCodes.NotImplemented;
  public override readonly type: string = `https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/${this.status}`;
}

export class ForbiddenError extends HttpError {
  public override readonly status = HttpStatusCodes.Forbidden;
  public override readonly type: string = `https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/${this.status}`;
}

export class UnsupportedMediaTypeError extends HttpError {
  public override readonly status = HttpStatusCodes.UnsupportedMediaType;
  public override readonly type: string = `https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/${this.status}`;
}