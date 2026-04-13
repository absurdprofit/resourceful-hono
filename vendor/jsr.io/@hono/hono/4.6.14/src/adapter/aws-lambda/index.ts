/**
 * @module
 * AWS Lambda Adapter for Hono.
 */

export { handle, streamHandle } from './handler.ts'
export type { APIGatewayProxyResult, LambdaEvent } from './handler.ts'
export type {
  ApiGatewayRequestContext,
  ApiGatewayRequestContextV2,
  ALBRequestContext,
  LambdaContext,
} from './types.ts'
