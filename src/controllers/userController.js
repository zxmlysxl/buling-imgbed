import { signToken } from '../utils/jwt'
import { hash } from '../utils/hash'

const userController = {
    async getAllUsers(c) {
        try {
            const { results } = await c.env.MY_DB.prepare(
                'SELECT * FROM users'
            ).all()
            return c.json({
                success: true,
                message: '获取用户列表成功',
                data: results
            })
        } catch (error) {
            return c.json({
                success: false,
                message: error.message
            }, 500)
        }
    },

    async getProfile(c) {
        try {
            const user = c.get('jwtPayload')
            const { results } = await c.env.MY_DB.prepare(
                'SELECT chat_id,username, r2_custom_url,enable_baidu_cdn, enable_image_optimization FROM users WHERE id = ?'
            ).bind(user.id).all()

            if (results.length === 0) {
                return c.json({
                    success: false,
                    message: '用户不存在'
                }, 404)
            }

            return c.json({
                success: true,
                message: '获取用户信息成功',
                data: results[0]
            })
        } catch (error) {
            return c.json({
                success: false,
                message: error.message
            }, 500)
        }
    },

    async updateUser(c) {
        try {
            const { id } = c.get('jwtPayload')
            const { field, value } = c.get('validatedBody')

            // 检查用户是否存在
            // const { results: userResults } = await c.env.MY_DB.prepare(
            //     'SELECT * FROM users WHERE id = ?'
            // ).bind(id).all()

            // if (userResults.length === 0) {
            //     return c.json({ 
            //         success: false, 
            //         message: '用户不存在' 
            //     }, 404)
            // }

            // 根据field选择更新字段
            let updateValue = value

            switch (field) {
                case 'chat_id':
                    // 检查 chat_id 是否为空或者不是纯数字，或者是纯数字字符串
                    if (!value || isNaN(value) || typeof value === 'string') {
                        return c.json({
                            success: false,
                            message: 'chat_id 必须是纯数字'
                        }, 400)
                    }
                    // 检查是否已经被其他用户绑定
                    const { results: existingChatId } = await c.env.MY_DB.prepare(
                        'SELECT username FROM users WHERE chat_id = ?'
                    ).bind(value).all();

                    if (existingChatId && existingChatId.length > 0) {
                        return c.json({
                            success: false,
                            message: `该Telegram账号已被${existingChatId[0].username}绑定`
                        }, 400);
                    }

                    break;

                case 'username':
                    // 检查用户名长度
                    if (value.length < 3) {
                        return c.json({
                            success: false,
                            message: '用户名长度至少为3个字符'
                        }, 400)
                    }
                    // 检查用户名是否已存在
                    const { results: existingUser } = await c.env.MY_DB.prepare(
                        'SELECT id FROM users WHERE username = ? AND id != ?'
                    ).bind(value, id).all()

                    if (existingUser.length > 0) {
                        return c.json({
                            success: false,
                            message: '用户名已被使用'
                        }, 400)
                    }
                    break;

                case 'password':
                    // 检查密码长度
                    if (value.length < 5) {
                        return c.json({
                            success: false,
                            message: '密码长度至少为5个字符'
                        }, 400)
                    }
                    updateValue = await hash(value)
                    break;

                case 'r2_custom_url':
                    // 检查URL格式
                    try {
                        new URL(value);
                    } catch (error) {
                        return c.json({
                            success: false,
                            message: '无效的URL格式'
                        }, 400)
                    }
                    break;


                case 'enable_baidu_cdn':
                case 'enable_image_optimization':
                    // 确保布尔值转换为0或1
                    updateValue = value ? 1 : 0
                    break;

                default:
                    return c.json({
                        success: false,
                        message: '不支持的更新字段'
                    }, 400)
            }

            // 执行更新
            const updateQuery = `
                UPDATE users 
                SET ${field} = ?
                WHERE id = ?
                RETURNING id, chat_id,username,r2_custom_url, enable_baidu_cdn, 
                          enable_image_optimization
            `
            const { results: updatedUser } = await c.env.MY_DB.prepare(updateQuery)
                .bind(updateValue, id)
                .all()

            // 添加检查
            if (!updatedUser || updatedUser.length === 0) {
                return c.json({
                    success: false,
                    message: '更新失败，用户不存在'
                }, 404)
            }

            // 生成新的 token
            const token = await signToken(
                updatedUser[0],
                c.env
            )

            return c.json({
                success: true,
                message: '用户信息更新成功',
                data: {
                    chat_id: updatedUser[0].chat_id,
                    username: updatedUser[0].username,
                    r2_custom_url: updatedUser[0].r2_custom_url,
                    enable_baidu_cdn: updatedUser[0].enable_baidu_cdn,
                    enable_image_optimization: updatedUser[0].enable_image_optimization
                },
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

export { userController } 