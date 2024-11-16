import { Hono } from 'hono'
import { userController } from '../controllers/userController'
import { authMiddleware } from '../middlewares/authMiddleware'
import { validateRequest } from '../middlewares/validateMiddleware'
import { updateUserSchema } from '../schemas/userSchema'

const userRoutes = new Hono()

// 所有获取用户信息路由都需要认证
userRoutes.use('*', (c, next) => authMiddleware(c.env)(c, next))
// userRoutes.get('/all', userController.getAllUsers)
userRoutes.get('/profile', userController.getProfile)
userRoutes.put('/update', validateRequest(updateUserSchema), userController.updateUser)

export { userRoutes } 