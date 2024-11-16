import {  decode, sign, verify } from 'hono/jwt'
import { signToken } from '../utils/jwt'
import { hash, compare } from '../utils/hash'

const authController = {
  async register(c) {
    try {
      const { username, password } = c.get('validatedBody')
      
      // 检查用户是否已存在
      const { results: existingUser } = await c.env.MY_DB.prepare(
        'SELECT * FROM users WHERE username = ?'
      ).bind(username).all()
      
      if (existingUser.length > 0) {
        return c.json({ 
          success: false, 
          message: '用户名已存在'
        }, 400)
      }
      
      // 密码加密
      const hashedPassword = await hash(password)
      
      // 创建新用户
      const { results } = await c.env.MY_DB.prepare(
        'INSERT INTO users (username, password) VALUES (?, ?) RETURNING *'
      ).bind(username, hashedPassword).all()
      
      // 生成 JWT token
      const token = await signToken(
        {
          id: results[0].id,
          chat_id: results[0].chat_id,
          username: results[0].username,
          r2_custom_url: results[0].r2_custom_url,
          enable_baidu_cdn: results[0].enable_baidu_cdn,
          enable_image_optimization: results[0].enable_image_optimization
        },
        c.env
      )
      
      return c.json({ 
        success: true,
        message: '注册成功',
        token
      })
    } catch (error) {
      return c.json({ 
        success: false, 
        message: error.message 
      }, 500)
    }
  },

  async login(c) {
    try {
      const { username, password } = c.get('validatedBody')
      
      // 查找用户
      const { results } = await c.env.MY_DB.prepare(
        'SELECT * FROM users WHERE username = ?'
      ).bind(username).all()
      
      if (results.length === 0) {
        return c.json({ 
          success: false, 
          message: '用户名或密码错误' 
        }, 401)
      }
      
      // 验证密码
      const user = results[0]
      const isValidPassword = await compare(password, user.password)
      
      if (!isValidPassword) {
        return c.json({ 
          success: false, 
          message: '用户名或密码错误' 
        }, 401)
      }
      
      // 生成JWT token
      const token = await signToken(
        {
          id: user.id,
          chat_id: user.chat_id,
          username: user.username,
          r2_custom_url: user.r2_custom_url,
          enable_baidu_cdn: user.enable_baidu_cdn,
          enable_image_optimization: user.enable_image_optimization
        },
        c.env
      )
      
      return c.json({ 
        success: true,
        message: '登录成功',
        token
      })
    } catch (error) {
      return c.json({ 
        success: false, 
        message: error.message 
      }, 500)
    }
  }
}

export { authController } 