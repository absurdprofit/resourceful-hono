import type { HttpStatusCodes } from './common/enums.ts';

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  traceparent?: string;
}

export interface HttpErrorOptions extends ErrorOptions {
  instance?: string;
  traceparent?: string;
}

/**
 * Base class for HTTP errors that serialize to Problem Details (RFC 7807).
 *
 * When thrown inside a `Resource` handler, subclass instances of `HttpError`
 * are automatically caught, serialized, and returned with appropriate HTTP status and
 * `application/problem+json` content type.
 *
 * Designed to be extended (e.g. `BadRequestError`, `NotFoundError`, etc.).
 *
 * @abstract
 * @extends {Error}
 *
 * @example
 * ```ts
 * class BadRequestError extends HttpError {
 *   public readonly status = 400;
 *   public readonly type = 'https://example.com/probs/bad-request';
 * }
 *
 * class UserResource extends Resource {
 *   // -> Will return 400 with a problem+json body
 *   public POST() {
 *     throw new BadRequestError('Missing email field');
 *   }
 * }
 * 
 * ```
 */
export abstract class HttpError extends Error {
  public abstract readonly status: HttpStatusCodes | number;
  public abstract readonly type: string;
  public instance?: string;
  public traceparent?: string;

  constructor(message?: string, options?: HttpErrorOptions) {
    super(message, options);

    this.name = this.constructor.name;
  }

  public static fromJSON(
    this: new (message?: string, options?: HttpErrorOptions) => HttpError,
    json: ProblemDetails
  ): HttpError {
    return new this(
      json.detail,
      { instance: json.instance, traceparent: json.traceparent }
    );
  }

  public toJSON() {
    return {
      title: this.name,
      detail: this.message,
      traceparent: this.traceparent,
      instance: this.instance,
      type: this.type,
      status: this.status,
    };
  }

  /**
   * Custom `instanceof` behavior to support polymorphic type checks across subclasses.
   *
   * This enables checks like `err instanceof BadRequestError` to pass even if the
   * prototype chain was altered during serialization or transport.
   *
   * Additionally, it restores the prototype chain if the error was partially deserialized
   * or created from another context (e.g., across a boundary).
   *
   * @param {unknown} obj - The object to check.
   * @returns {boolean} True if `obj` is an instance of `HttpError` or a subclass.
   *
   * @example
   * ```ts
   * if (err instanceof NotFoundError) {
   *   // works even if `err` came from a different context
   * }
   * ```
   */
  public static override [Symbol.hasInstance](obj: unknown): obj is HttpError {
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