import { HttpStatusCodes } from "./enums.ts";

export abstract class HttpError extends Error {
  public abstract readonly status: HttpStatusCodes;
  public abstract readonly type: string;
  public readonly title;
  public readonly detail;

  constructor(message?: string, options?: ErrorOptions) {
    super(message, options);

    this.title = this.constructor.name;
    this.detail = message ?? "";
  }
  
  static override [Symbol.hasInstance](obj: unknown): boolean {
    if (typeof obj !== 'object' || obj === null) return false;
    if (this === HttpError) {
        return Object.prototype.isPrototypeOf.call(this.prototype, obj);
    } else if (obj instanceof HttpError && obj.name === this.name) {
        // implicit cast to derived HttpError instance, e.g. BadRequestError, NotFoundError etc.
        if (Object.getPrototypeOf(obj) !== this.prototype)
            Object.setPrototypeOf(obj, this.prototype);
        return true;
    }
    return false;
  }
}

export class NotFoundError extends HttpError {
  public override readonly status = HttpStatusCodes.NotFound;
  public override readonly type = `https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/${this.status}`;
}

export class ConflictError extends HttpError {
  public override readonly status = HttpStatusCodes.Conflict;
  public override readonly type = `https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/${this.status}`;
}

interface BadRequestErrorOptions extends ErrorOptions {
  issues: object[];
}

export class BadRequestError extends HttpError {
  public override readonly status = HttpStatusCodes.BadRequest;
  public override readonly type = `https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/${this.status}`;
  public readonly issues: object[];

  constructor(message?: string, options?: BadRequestErrorOptions) {
    super(message, options);
    this.issues = options?.issues ?? [];
  }
}

export class InternalServerError extends HttpError {
  public override readonly status = HttpStatusCodes.InternalServerError;
  public override readonly type = `https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/${this.status}`;
}

export class UnauthorizedError extends HttpError {
  public override readonly status = HttpStatusCodes.Unauthorized;
  public override readonly type = `https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/${this.status}`;
}

export class DependencyFailedError extends HttpError {
  public override readonly status = HttpStatusCodes.DependencyFailed;
  public override readonly type = `https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/${this.status}`;
}

export class MethodNotAllowedError extends HttpError {
  public override readonly status = HttpStatusCodes.MethodNotAllowed;
  public override readonly type = `https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/${this.status}`;
}

export class NotImplementedError extends HttpError {
  public override readonly status = HttpStatusCodes.NotImplemented;
  public override readonly type = `https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/${this.status}`;
}

export class ForbiddenError extends HttpError {
  public override readonly status = HttpStatusCodes.Forbidden;
  public override readonly type = `https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/${this.status}`;
}

export class UnsupportedMediaTypeError extends HttpError {
  public override readonly status = HttpStatusCodes.UnsupportedMediaType;
  public override readonly type = `https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/${this.status}`;
}