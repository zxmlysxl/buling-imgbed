import { sign } from 'hono/jwt'

export const signToken = async (payload, env) => {
  const now = Math.floor(Date.now() / 1000)
  const claims = {
    ...payload,
    iat: now,
    nbf: now,
    exp: now + 30 * 24 * 60 * 60,
  }
  return await sign(claims, env.JWT_SECRET)
} 