import type { HttpStatusCodes } from './common/enums.ts';

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
 * 
 * HttpError has `instanceof` behavior to support polymorphic type checks across subclasses.
 *
 * This enables checks like `err instanceof BadRequestError` to pass even if the
 * prototype chain was altered during serialization or transport.
 *
 * Additionally, it restores the prototype chain if the error was partially deserialized
 * or created from another context (e.g., across a boundary).
 *
 * @example
 * ```ts
 * if (err instanceof NotFoundError) {
 *   // works even if `err` came from a different context
 * }
 * ```
 */
export abstract class HttpError extends Error {
  public abstract readonly status: HttpStatusCodes | number;
  public abstract readonly type: string;
  public readonly title: string;
  public readonly detail: string;
  public instance: string | null = null;
  public traceparent: string | null = null;

  constructor(message?: string, options?: ErrorOptions) {
    super(message, options);

    this.title = this.name = this.constructor.name;
    this.detail = message ?? '';
  }

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