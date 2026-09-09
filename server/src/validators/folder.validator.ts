import { z } from 'zod'

const folderName = z
  .string({ message: 'Tên thư mục phải là chuỗi ký tự' })
  .trim()
  .min(1, 'Tên thư mục không được để trống')
export const createFolderSchema = z.object({ name: folderName })
export const updateFolderSchema = z.object({ name: folderName })
