export const assertDecodableImage = async (file: File): Promise<void> => {
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    if (!image.naturalWidth || !image.naturalHeight)
      throw new Error('Ảnh không có kích thước hợp lệ')
  } catch {
    throw new Error('Nội dung tệp không phải ảnh hợp lệ hoặc ảnh đã bị hỏng')
  } finally {
    URL.revokeObjectURL(url)
  }
}
