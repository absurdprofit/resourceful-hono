import { expect } from "expect";
import { HttpError } from "../HttpError.ts";
import { GenericHttpError, NotFoundError } from "../common/errors.ts";

Deno.test('HttpError instance returns false for non-object', () => {
  expect(HttpError[Symbol.hasInstance](0)).toBe(false);
});

Deno.test('HttpError instanceof casts generic error to HttpError', () => {
  class CustomHttpError extends HttpError {
    public static readonly brand = Symbol();
    public override readonly status = 430;
    public override readonly type: string = `http://localhost/HTTP/Status/${this.status}`;

    get brand() {
      return CustomHttpError.brand;
    }
  }
  const error = new GenericHttpError(new CustomHttpError());

  expect(error).toBeInstanceOf(CustomHttpError);
  expect(error.brand).toBe(CustomHttpError.brand);
  expect(error instanceof NotFoundError).toBe(false);
});