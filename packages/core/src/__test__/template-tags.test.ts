import { expect } from 'expect';
import { b } from '../common/template-tags.ts';

Deno.test('b template tag converts string to Uint8Array', () => {
  const message = 'hello world';
  const bytes = b`${message}`;
  const encoder = new TextEncoder();

  expect(bytes).toBeInstanceOf(Uint8Array);
  expect(bytes).toEqual(encoder.encode(message));
});