import { HttpError } from '../HttpError.ts';
import { HttpStatusCodes } from './enums.ts';

/**
 * A flexible `HttpError` implementation that allows dynamic creation of error instances at runtime.
 *
 * Useful when rehydrating or proxying problem detail objects from other services,
 * or for constructing custom `HttpError`s without creating a new subclass.
 *
 * Accepts all properties defined in `HttpError`, and supports adding arbitrary extra fields.
 *
 * @extends {HttpError}
 *
 * @example
 * ```ts
 * throw new GenericHttpError({
 *   status: 409,
 *   type: 'https://example.com/probs/conflict',
 *   title: 'Conflict',
 *   detail: 'User already exists.',
 *   instance: '/users/123',
 *   traceparent: '00-abc123...',
 *   retryAfter: '30s' // extra field
 * });
 * ```
 */
export class GenericHttpError extends HttpError {
  public override readonly status: number;
  public override type: string;
  public readonly json;

  constructor(message: string, json: ReturnType<HttpError['toJSON']>) {
    super(message, { instance: json.instance, traceparent: json.traceparent });

    this.name = json.title;
    this.status = json.status;
    this.type = json.type;
    this.json = json;
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

  public static override fromJSON(json: ProblemDetails & { issues: object[] }) {
    return new BadRequestError(json.detail, { issues: json.issues });
  }

  public override toJSON() {
    return {
      ...super.toJSON(),
      issues: this.issues,
    };
  }
}

export class InternalServerError extends HttpError {
  public override readonly status = HttpStatusCodes.InternalServerError;
  public override readonly type: string = `https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/${this.status}`;
}

export class ServiceUnavailableError extends HttpError {
  public override readonly status = HttpStatusCodes.ServiceUnavailable;
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

export class UnprocessableContentError extends HttpError {
  public override readonly status = HttpStatusCodes.UnprocessableContentError;
  public override readonly type: string = `https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/${this.status}`;
}