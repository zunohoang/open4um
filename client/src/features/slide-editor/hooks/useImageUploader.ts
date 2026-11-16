import { useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import { editorApi } from '../api/editor.api'

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024
// SVG bị loại vì có thể chứa script khi phục vụ từ server
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
]
export const IMAGE_ACCEPT = ALLOWED_IMAGE_TYPES.join(',')

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

// SRS UC011: kiểm tra tệp (4a) -> tải lên server (5) -> lỗi thì cho Thử lại (5a)
export const useImageUploader = (
  onUploaded: (url: string, file: File) => void
) => {
  const { showToast } = useToast()
  const [isUploading, setIsUploading] = useState(false)
  const [failedFile, setFailedFile] = useState<File | null>(null)

  const upload = async (file: File) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
      showToast(
        'Định dạng tệp không được hỗ trợ. Vui lòng chọn ảnh JPG, PNG, WEBP hoặc GIF.',
        'error'
      )
      return
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      showToast(
        `Kích thước ảnh (${(file.size / (1024 * 1024)).toFixed(1)}MB) vượt quá giới hạn 5MB cho phép.`,
        'error'
      )
      return
    }
    setIsUploading(true)
    setFailedFile(null)
    try {
      const url = await editorApi.uploadImage(await readAsDataUrl(file))
      onUploaded(url, file)
    } catch {
      setFailedFile(file)
      showToast('Tải ảnh lên thất bại. Bấm "Thử lại" để tải lại.', 'error')
    } finally {
      setIsUploading(false)
    }
  }

  return {
    upload,
    isUploading,
    failedFile,
    retry: () => failedFile && void upload(failedFile),
    dismissFailure: () => setFailedFile(null)
  }
}
