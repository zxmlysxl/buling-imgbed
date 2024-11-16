import { isValidImageType } from '../utils/imageUtils';

export const imageController = {
    async uploadImage(c) {
        try {
            const userId = c.get('jwtPayload').id;

            const formData = await c.req.formData();
            let imgfile = formData.get('imgfile');

            if (!imgfile || !isValidImageType(imgfile.type)) {
                return c.json({ success: false, message: '请选择有效的图片文件' }, 400)
            }

            if (imgfile.size > 10 * 1024 * 1024) {
                return c.json({ success: false, message: '文件大小不能超过10MB' }, 400)
            }


            // 生成原始文件名（基于时间戳和文件名）
            const originalFilename = `${Date.now()}-${imgfile.name}`;

            // 生成MD5哈希值
            const encoder = new TextEncoder();
            const data = encoder.encode(originalFilename);
            const hashBuffer = await crypto.subtle.digest('MD5', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

            // 获取文件扩展名
            const extension = imgfile.name.split('.').pop();
            const filename = `${hashHex}.${extension}`;


            // 先保存到数据库
            await c.env.MY_DB.prepare(
                'INSERT INTO images (user_id, filename) VALUES (?, ?)'
            ).bind(userId, filename).run();

            // 数据库保存成功后，再上传到R2
            await c.env.MY_BUCKET.put(filename, imgfile.stream(), {
                httpMetadata: { contentType: imgfile.type }
            });


            return c.json({
                success: true,
                message: '图片上传成功',
                data: {
                    filename,
                    userId  // 添加userId用于调试
                }
            });
        } catch (error) {
            return c.json({
                success: false,
                message: `上传失败: ${error.message}`
            }, 500);
        }
    },

    async deleteImages(c) {
        try {
            const { files } = await c.req.json()
            const userId = c.get('jwtPayload').id;

            if (!Array.isArray(files)) {
                return c.json({
                    success: false,
                    message: '无效的图片请求'
                }, 400)
            }

            // 先从 R2 删除文件
            try {
                await c.env.MY_BUCKET.delete(files);
            } catch (error) {
                return c.json({
                    success: false,
                    message: '从存储中删除文件失败'
                }, 500);
            }

            // R2 删除成功后，再从数据库中删除记录
            const stmt = await c.env.MY_DB.prepare(
                'DELETE FROM images WHERE filename IN (' + files.map(() => '?').join(',') + ') AND user_id = ?'
            ).bind(...files, userId).run();

            return c.json({
                success: true,
                message: '图片删除成功',
                data: {
                    files
                }
            });
        } catch (error) {
            return c.json({
                success: false,
                message: error.message
            }, 500)
        }
    },

    async listR2Images(c) {
        try {
            const cursor = c.req.query('cursor'); // 获取分页游标
            const limit = parseInt(c.req.query('limit')) || 10; // 获取每页数量，默认10
            // cursor 的值是不透明的（opaque）
            // 按页码查询在 R2 中不能直接实现，因为 R2 只支持基于 cursor 的分页。
            // 通过在数据库中维护文件列表来实现按页码查询。


            const options = {
                limit,
                cursor // 如果cursor存在，将从此位置开始获取
            }

            const list = await c.env.MY_BUCKET.list(options)
            const images = list.objects.map((obj, index) => ({
                index: index + 1,  // 从1开始的序号
                filename: obj.key,
                size: obj.size / 1024 + 'KB',
                rawSize: obj.size,
                uploaded: obj.uploaded,
                type: obj.httpMetadata?.contentType,
                etag: obj.etag,
                httpEtag: obj.httpEtag,
                checksums: {
                    md5: obj.checksums?.md5,
                    sha1: obj.checksums?.sha1,
                    sha256: obj.checksums?.sha256
                },
                customMetadata: obj.customMetadata || {},
                version: obj.version,
                lastModified: new Date(obj.uploaded).toLocaleString(),
                // 添加分页相关信息
                cursor: obj.cursor,
                prefix: obj.prefix,
                delimiter: obj.delimiter,
                // 添加其他有用的信息
                range: obj.range,
                writeHttpMetadata: obj.writeHttpMetadata,
                httpMetadataJSON: JSON.stringify(obj.httpMetadata || {})
            }))

            return c.json({
                success: true,
                message: '获取图片列表成功',
                size: images.length,
                data: {
                    images,
                    truncated: list.truncated, // 是否还有更多图片
                    cursor: list.cursor // 返回下一页的游标
                }
            })
        } catch (error) {
            return c.json({
                success: false,
                message: error.message
            }, 500)
        }
    },

    async listImages(c) {
        try {
            const userId = c.get('jwtPayload').id;
            const { page = 1, pageSize = 10 } = await c.req.json();  
            const offset = (page - 1) * pageSize;

            // 获取总数
            const { total } = await c.env.MY_DB.prepare(
                'SELECT COUNT(*) as total FROM images WHERE user_id = ?'
            ).bind(userId).first();

            // 分页查询
            const { results } = await c.env.MY_DB.prepare(
                'SELECT filename, created_at FROM images WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
            ).bind(userId, pageSize, offset).all();

            const imageList = results.map(img => ({
                filename: img.filename,
                url: `${img.filename}`,
                created_at: img.created_at
            }));

            return c.json({
                success: true,
                message: '获取图片列表成功',
                data: {
                    list: imageList,
                    pagination: {
                        current: page,
                        pageSize,
                        total,
                        totalPages: Math.ceil(total / pageSize)
                    }
                }
            });
        } catch (error) {
            return c.json({
                success: false,
                message: error.message
            }, 500);
        }
    }
} 