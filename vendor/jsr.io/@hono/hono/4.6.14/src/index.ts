/**
 * @module
 *
 * Hono - Web Framework built on Web Standards
 *
 * @example
 * ```ts
 * import { Hono } from 'hono'
 * const app = new Hono()
 *
 * app.get('/', (c) => c.text('Hono!'))
 *
 * export default app
 * ```
 */

import { Hono } from './hono.ts'

/**
 * Types for environment variables, error handlers, handlers, middleware handlers, and more.
 */
export type {
  Env,
  ErrorHandler,
  Handler,
  MiddlewareHandler,
  Next,
  NotFoundHandler,
  ValidationTargets,
  Input,
  Schema,
  ToSchema,
  TypedResponse,
} from './types.ts'
/**
 * Types for context, context variable map, context renderer, and execution context.
 */
export type { Context, ContextVariableMap, ContextRenderer, ExecutionContext } from './context.ts'
/**
 * Type for HonoRequest.
 */
export type { HonoRequest } from './request.ts'
/**
 * Types for inferring request and response types and client request options.
 */
export type { InferRequestType, InferResponseType, ClientRequestOptions } from './client/index.ts'

/**
 * Hono framework for building web applications.
 */
export { Hono }
