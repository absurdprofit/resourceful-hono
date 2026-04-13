/**
 * @module
 * JWT utility.
 */

import { decode, sign, verify } from './jwt.ts'
export const Jwt = { sign, verify, decode }
