import { isValidImageType, getContentTypeFromExtension } from '../utils/imageUtils';

export const tgbotController = {
    async handleWebhook(c) {
        let chatId;
        try {
            const update = await c.req.json();

            if (!update.message) {
                return c.json({ success: true });
            }

            chatId = update.message.chat.id;

            // 检查是否为图片消息
            if (!update.message.photo && !update.message.document) {
                await sendTelegramMessage(c.env.TG_BOT_TOKEN, chatId,
                    '只能接收图片哦。');
                return c.json({ success: true });
            }

            // 直接从 users 表查询
            const { results } = await c.env.MY_DB.prepare(
                'SELECT id,r2_custom_url,enable_baidu_cdn FROM users WHERE chat_id = ?'
            ).bind(chatId).all();

            // 如果用户未绑定
            if (!results || results.length === 0) {
                await sendTelegramMessage(c.env.TG_BOT_TOKEN, chatId,
                    `请先在网站上登录并绑定您的Telegram账号 - ${chatId}`);
                return c.json({ success: true });
            }

            const userId = results[0].id;
            const r2_custom_url = results[0].r2_custom_url;
            const enable_baidu_cdn = results[0].enable_baidu_cdn;



            // 处理图片消息
            let fileId;
            if (update.message.photo) {
                fileId = update.message.photo[update.message.photo.length - 1].file_id;
            } else {
                const mime = update.message.document.mime_type;
                if (!isValidImageType(mime)) {
                    await sendTelegramMessage(c.env.TG_BOT_TOKEN, chatId,
                        '不支持的图片类型。');
                    return c.json({ success: true });
                }
                fileId = update.message.document.file_id;
            }

            // 获取文件并上传
            const fileInfo = await getFileInfo(c.env.TG_BOT_TOKEN, fileId);
            const fileUrl = `https://api.telegram.org/file/bot${c.env.TG_BOT_TOKEN}/${fileInfo.file_path}`;

            const response = await fetch(fileUrl);
            const blob = await response.blob();

            // 生成原始文件名（基于时间戳和文件名）
            const originalFilename = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

            // 生成MD5哈希值
            const encoder = new TextEncoder();
            const data = encoder.encode(originalFilename);
            const hashBuffer = await crypto.subtle.digest('MD5', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

            const extension = fileInfo.file_path.split('.').pop().toLowerCase();
            const contentType = getContentTypeFromExtension(extension);
            const filename = `${hashHex}.${extension}`;


            // 保存到数据库
            await c.env.MY_DB.prepare(
                'INSERT INTO images (user_id, filename) VALUES (?, ?)'
            ).bind(userId, filename).run();

            // 上传到R2
            await c.env.MY_BUCKET.put(filename, blob, {
                httpMetadata: { contentType: contentType }
            });

            // 构建图片URL
            let imageUrl = `${r2_custom_url}/${filename}`;
            let baiduUrl = enable_baidu_cdn ?
                `https://image.baidu.com/search/down?url=${imageUrl}` : '';

            const messageText =
`*🎉 图片上传成功！*

*⚡️ 图片直链*
> \`${imageUrl}\`
${baiduUrl ? `
*💨 百度加速*
> \`${baiduUrl}\`
` : ''}
*💫 HTML代码*
> \`<img src="${imageUrl}" alt="image">\`

*⭐️ BBCode*
> \`[img]${imageUrl}[/img]\`

*🌙 Markdown*
> \`![](${imageUrl})\`

_💡 点击链接可直接复制对应内容_`;

            // 使用 Markdown 格式发送消息
            await sendTelegramMessage(c.env.TG_BOT_TOKEN, chatId, messageText, 'MarkdownV2');

            return c.json({ success: true });
        } catch (error) {
            console.error('Telegram webhook error:', error);
            if (chatId) {
                await sendTelegramMessage(c.env.TG_BOT_TOKEN, chatId,
                    `TG接口异常\n: ${error}`);
            }
            return c.json({ success: false, error: error.message }, 500);
        }
    }
};

// 辅助函数
async function sendTelegramMessage(botToken, chatId, text, parseMode) {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            chat_id: chatId,
            text: text,
            disable_web_page_preview: true,
            parse_mode: parseMode
        })
    });
}

async function getFileInfo(botToken, fileId) {
    const url = `https://api.telegram.org/bot${botToken}/getFile`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            file_id: fileId
        })
    });
    const data = await response.json();
    return data.result;
}

