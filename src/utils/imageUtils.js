export const MIME_TYPES = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'bmp': 'image/bmp',
    'tiff': 'image/tiff',
    'tif': 'image/tiff',
    'ico': 'image/x-icon',
    'avif': 'image/avif',
    'heic': 'image/heic',
    'heif': 'image/heif'
};

export const isValidImageType = (mimeType) => {
    return Object.values(MIME_TYPES).includes(mimeType);
};

export const getContentTypeFromExtension = (extension) => {
    return MIME_TYPES[extension.toLowerCase()] || 'application/octet-stream';
}; 