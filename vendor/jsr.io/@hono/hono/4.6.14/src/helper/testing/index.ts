/**
 * @module
 * Testing Helper for Hono.
 */

import { hc } from '../../client/index.ts'
import type { Client } from '../../client/types.ts'
import type { ExecutionContext } from '../../context.ts'
import type { Hono } from '../../hono.ts'
import type { Schema } from '../../types.ts'
import type { UnionToIntersection } from '../../utils/types.ts'

type ExtractEnv<T> = T extends Hono<infer E, Schema, string> ? E : never

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const testClient = <T extends Hono<any, Schema, string>>(
  app: T,
  Env?: ExtractEnv<T>['Bindings'] | {},
  executionCtx?: ExecutionContext
): UnionToIntersection<Client<T>> => {
  const customFetch = (input: RequestInfo | URL, init?: RequestInit) => {
    return app.request(input, init, Env, executionCtx)
  }

  return hc<typeof app>('http://localhost', { fetch: customFetch })
}
