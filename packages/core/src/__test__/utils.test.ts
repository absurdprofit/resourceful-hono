import { expect } from 'expect';
import { isBodyInit, isResourceConstructor, isSuppressedError } from '../common/types.ts';
import { Resource } from '../Resource.ts';
import type { Context } from 'hono';
import { setMetric } from 'hono/timing';
import { parseTotalDuration, literalToLowerCase, literalToUpperCase, toFormData } from '../common/utils.ts';

// Setup dummy Resource for testing isResourceConstructor
class DummyResource extends Resource {}

class ValidResource extends DummyResource {}
function NotAResource() {}

Deno.test('isResourceConstructor: valid resource constructor', () => {
  expect(isResourceConstructor(ValidResource)).toBe(true);
});

Deno.test('isResourceConstructor: invalid resource constructor', () => {
  // Function that does not extend DummyResource
  expect(isResourceConstructor(NotAResource)).toBe(false);
  // Non-function values
  expect(isResourceConstructor({})).toBe(false);
  expect(isResourceConstructor(123)).toBe(false);
});

Deno.test('isBodyInit: valid BodyInit values', () => {
  expect(isBodyInit('a string')).toBe(true);
  expect(isBodyInit(new Blob(['data']))).toBe(true);
  expect(isBodyInit(new ArrayBuffer(10))).toBe(true);
  expect(isBodyInit(new FormData())).toBe(true);
  expect(isBodyInit(new URLSearchParams())).toBe(true);
  expect(isBodyInit(new ReadableStream())).toBe(true);
});

Deno.test('isBodyInit: invalid BodyInit values', () => {
  expect(isBodyInit(42)).toBe(false);
  expect(isBodyInit({})).toBe(false);
  expect(isBodyInit(null)).toBe(false);
  expect(isBodyInit(undefined)).toBe(false);
});

if (typeof SuppressedError === 'undefined') {
  class SuppressedError extends Error implements globalThis.SuppressedError {
    public error: unknown;
    public suppressed: unknown;
    constructor(error: unknown, suppressed: unknown, message?: string | undefined) {
      super(message || 'Suppressed Error');
      this.error = error;
      this.suppressed = suppressed;
      this.name = 'SuppressedError';
    }
  }
  globalThis.SuppressedError = SuppressedError as unknown as SuppressedErrorConstructor;
}
Deno.test('isSuppressedError: valid SuppressedError', () => {
  expect(isSuppressedError(new SuppressedError(new Error(), ''))).toBe(true);
});

Deno.test('isSuppressedError: invalid SuppressedError', () => {
  expect(isSuppressedError(new Error())).toBe(false);
});

Deno.test('parseTotalDuration: valid timing metric', () => {
  const context = new Map() as unknown as Context;
  const headers: string[] = [];
  const timers = new Map<string, unknown>();
  context.set('metric', { headers, timers });
  setMetric(context, 'total', 1, 'description');
  
  const value = parseTotalDuration(context.get('metric')?.headers ?? []);

  expect(value).toBe('1.0');
});

Deno.test('literalToLowerCase: converts strings to lowercase', () => {
  const result1 = literalToLowerCase('HELLO');
  expect(result1).toBe('hello');

  const result2 = literalToLowerCase('MiXeD');
  expect(result2).toBe('mixed');
});

Deno.test('literalToUpperCase: converts strings to uppercase', () => {
  const result1 = literalToUpperCase('hello');
  expect(result1).toBe('HELLO');

  const result2 = literalToUpperCase('MiXeD');
  expect(result2).toBe('MIXED');
});

Deno.test('toFormData: handles Blob/File values correctly', () => {
  const blob = new File(['content'], 'file.txt', { type: 'text/plain' });
  const input = { file: blob };
  const formData = toFormData(input);
  expect(formData.get('file')).toBe(blob);
});

Deno.test('toFormData: returns the same instance when input is FormData', () => {
  const input = new FormData();
  input.append('key', 'value');
  const result = toFormData(input);
  expect(result).toBe(input);
});

Deno.test('toFormData throws TypeError when input is not an object', () => {
  expect(() => toFormData(null)).toThrow(TypeError);
  expect(() => toFormData('string')).toThrow(TypeError);
});