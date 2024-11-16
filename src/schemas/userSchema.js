import { z } from 'zod'

export const authSchema = z.object({
  username: z.string().min(3, '用户名至少3个字符'),
  password: z.string().min(5, '密码至少5个字符')
})



export const updateUserSchema = z.object({
  field: z.enum([
    'chat_id',
    'username',
    'password', 
    'r2_custom_url',
    'enable_baidu_cdn',
    'enable_image_optimization'
  ]),
  value: z.union([
    z.string().transform((val, ctx) => {
      if (ctx.path[0] === 'r2_custom_url') {
        // 验证是否为有效URL格式
        try {
          new URL(val);
          return val;
        } catch {
          return ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: '请输入有效的URL格式'
          });
        }
      }
      return val;
    }),
    z.number(),
    z.boolean()
  ])
}) 