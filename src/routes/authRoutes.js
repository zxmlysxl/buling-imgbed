import { Hono } from 'hono'
import { authController } from '../controllers/authController'
import { validateRequest } from '../middlewares/validateMiddleware'
import { authSchema } from '../schemas/userSchema'

const authRoutes = new Hono()

authRoutes.post('/login', validateRequest(authSchema), authController.login)
// authRoutes.post('/register', validateRequest(authSchema), authController.register)

export { authRoutes } 