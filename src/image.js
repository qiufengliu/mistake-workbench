// 照片压缩：手机原图 3-5 MB，直接存 localStorage 很快会满。
export const MAX_SIDE = 1280;
export const JPEG_QUALITY = 0.7;

// 按比例缩小，长边不超过 max；本来就小的图不放大。
export function fitSize(width, height, max = MAX_SIDE) {
  if (!(width > 0) || !(height > 0)) throw new Error('图片尺寸无效');
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

// data URL 实际占用的字节数（localStorage 按字符计，约等于这个值）。
export function dataUrlBytes(dataUrl) {
  return String(dataUrl).length;
}

// 浏览器里把图片文件压成 JPEG data URL。
export async function compressImage(file, { max = MAX_SIDE, quality = JPEG_QUALITY } = {}) {
  if (!file || !String(file.type).startsWith('image/')) throw new Error('请选择图片文件');
  // imageOrientation: 'from-image' 让手机竖拍的照片不倒。
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const { width, height } = fitSize(bitmap.width, bitmap.height, max);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; // 透明 PNG 转 JPEG 时底色用白色
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    bitmap.close?.();
  }
}

// 判断是不是浏览器存储满了的错误（不同浏览器名字不一样）。
export function isQuotaError(err) {
  if (!err) return false;
  return err.name === 'QuotaExceededError'
    || err.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    || err.code === 22 || err.code === 1014;
}
