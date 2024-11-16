export const validateRequest  = (schema) => {
    return async (c, next) => {
        try {
            const body = await c.req.json()
            const validatedData = await schema.parseAsync(body)
            c.set('validatedBody', validatedData)
            await next()
        } catch (error) {
            // Zod 验证错误处理
            if (error.issues && error.issues.length > 0) {
                return c.json({
                    success: false,
                    message: error.issues[0].message
                }, 400)
            }
            // 其他错误处理
            return c.json({
                success: false,
                message: error.message || '请求数据验证失败'
            }, 400)
        }
    }
} 