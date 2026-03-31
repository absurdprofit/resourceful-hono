import AsyncContextPolyfill from '@webfill/async-context';

const { AsyncContext = AsyncContextPolyfill } = globalThis as {
  AsyncContext?: typeof AsyncContextPolyfill
};

export { AsyncContext };