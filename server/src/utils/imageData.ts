import { AppError } from '@/utils/AppError'

// MIME và phần mở rộng không đủ chứng minh nội dung là ảnh.
export const decodeImageDataUrl = (dataUrl: string, maxBytes: number) => {
  const match =
    /^data:image\/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(
      dataUrl
    )
  if (!match)
    throw new AppError(
      'Định dạng ảnh không hợp lệ (chỉ PNG, JPG, WEBP, GIF)',
      422
    )
  const buffer = Buffer.from(match[2], 'base64')
  if (buffer.length > maxBytes)
    throw new AppError(
      `Ảnh vượt quá dung lượng cho phép (tối đa ${maxBytes / 1024 / 1024}MB)`,
      413
    )
  const mime = match[1].toLowerCase().replace('jpg', 'jpeg')
  const valid =
    mime === 'png'
      ? buffer.length >= 24 &&
        buffer
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
        buffer.toString('ascii', 12, 16) === 'IHDR'
      : mime === 'jpeg'
        ? buffer.length >= 4 &&
          buffer[0] === 255 &&
          buffer[1] === 216 &&
          buffer[2] === 255
        : mime === 'gif'
          ? buffer.length >= 13 &&
            ['GIF87a', 'GIF89a'].includes(buffer.toString('ascii', 0, 6))
          : buffer.length >= 16 &&
            buffer.toString('ascii', 0, 4) === 'RIFF' &&
            buffer.toString('ascii', 8, 12) === 'WEBP'
  if (!valid)
    throw new AppError(
      'Nội dung tệp không phải ảnh hợp lệ hoặc không khớp định dạng ảnh',
      422
    )
  return { buffer, mime: `image/${mime}` }
}
