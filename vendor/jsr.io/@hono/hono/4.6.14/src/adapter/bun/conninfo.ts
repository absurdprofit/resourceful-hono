import type { Context } from '../../index.ts'
import type { GetConnInfo } from '../../helper/conninfo/index.ts'
import { getBunServer } from './server.ts'

/**
 * Get ConnInfo with Bun
 * @param c Context
 * @returns ConnInfo
 */
export const getConnInfo: GetConnInfo = (c: Context) => {
  const server = getBunServer(c)

  if (!server) {
    throw new TypeError('env has to include the 2nd argument of fetch.')
  }
  if (typeof server.requestIP !== 'function') {
    throw new TypeError('server.requestIP is not a function.')
  }
  const info = server.requestIP(c.req.raw)

  return {
    remote: {
      address: info.address,
      addressType: info.family === 'IPv6' || info.family === 'IPv4' ? info.family : undefined,
      port: info.port,
    },
  }
}
