import type { HttpStatusCodes } from './common/enums.ts';

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
  
  static override [Symbol.hasInstance](obj: unknown): obj is HttpError {
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