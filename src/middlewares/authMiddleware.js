import { jwt,verify } from 'hono/jwt'

export const authMiddleware = (env) => {
  const middleware = jwt({
    secret: env.JWT_SECRET,
    message: '无效的认证令牌'
  })

  return async (c, next) => {
    try {
      const authHeader = c.req.header('Authorization')
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({ 
            success: false,
            message: '缺少认证令牌' }, 401)
      }

      const token = authHeader.substring(7)
      try {
        const decoded = await verify(token, env.JWT_SECRET)
        // console.log("authMiddleware-jwtPayload", decoded)
        c.set('jwtPayload', decoded)
      } catch (jwtError) {
        return c.json({ 
            success: false,
            message: '无效的认证令牌.'
        }, 401)
      }
      
      return await next()
    } catch (error) {
      return c.json({ 
        success: false,
        message: error.message || '认证过程发生错误' 
      }, 401)
    }
  }
} 