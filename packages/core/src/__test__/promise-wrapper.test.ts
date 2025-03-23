import { expect } from 'expect';
import { PromiseWrapper } from '../common/promise-wrapper.ts';

Deno.test('PromiseWrapper initializes with pending state', () => {
  const wrapper = new PromiseWrapper<number>();
  expect(wrapper.state).toBe('pending');
});

Deno.test('resolve() transitions state to resolved and fulfils the promise', async () => {
  const wrapper = new PromiseWrapper<number>();
  const value = 42;
  wrapper.resolve(value);
  expect(wrapper.state).toBe('resolved');
  await expect(wrapper.promise).resolves.toBe(value);
});

Deno.test('reject() transitions state to rejected and rejects the promise', async () => {
  const wrapper = new PromiseWrapper<number>();
  wrapper.reject(new Error('Something went wrong'));
  expect(wrapper.state).toBe('rejected');
  await expect(wrapper.promise).rejects.toThrow('Something went wrong');
});

Deno.test('promise remains pending until resolved or rejected', () => {
  const wrapper = new PromiseWrapper<string>();
  let settled = false;
  wrapper.promise.finally(() => (settled = true));
  expect(settled).toBe(false);
});
