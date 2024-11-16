import { Hono } from 'hono'
import { tgbotController } from '../controllers/tgbotController';
const tgbotRoutes = new Hono()

// TG webhook 接收消息的路由
tgbotRoutes.post('/webhook', tgbotController.handleWebhook);
// 绑定TG账号的路由
// tgbotRoutes.post('/bind', tgbotController.bindTelegramAccount);

export { tgbotRoutes }