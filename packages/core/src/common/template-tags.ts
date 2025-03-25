import { FIRST_INDEX, TEXT_ENCODER } from './constants.ts';

/**
 * Converts a template literal into a UTF-8 encoded `Uint8Array` buffer.
 *
 * Interpolates all values as strings, then encodes the final result using `TextEncoder`.
 * Useful for constructing binary payloads inline with string syntax.
 *
 * @param {TemplateStringsArray} strings - The static strings from the tagged template literal.
 * @param {unknown[]} values - The interpolated expressions within the template.
 * @returns {Uint8Array} A UTF-8 encoded byte array of the full interpolated string.
 *
 * @example
 * ```ts
 * const userId = 123;
 * const buffer = b`/api/users/${userId}`;
 * console.log(new TextDecoder().decode(buffer)); // "/api/users/123"
 * ```
 */
export function b(strings: TemplateStringsArray, ...values: unknown[]): Uint8Array<ArrayBufferLike> {
  let result = '';
  for (let i = FIRST_INDEX; i < strings.length; i++) {
    result += strings[i];
    if (i < values.length) {
      result += String(values[i]);
    }
  }
  return TEXT_ENCODER.encode(result);
}
