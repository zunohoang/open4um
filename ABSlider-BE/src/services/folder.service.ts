import { AppError } from '@/utils/AppError'
import { FolderModel } from '@/models/folder.model'
import { LectureModel } from '@/models/lecture.model'

export const createFolder = async (userId: string, name: string) => {
  return FolderModel.create({ userId, name })
}

export const listFolders = async (userId: string) => {
  return FolderModel.find({ userId }).sort({ createdAt: -1 })
}

const findOwnedFolder = async (userId: string, id: string) => {
  const folder = await FolderModel.findOne({ _id: id, userId })
  if (!folder) throw new AppError('Không tìm thấy thư mục', 404)
  return folder
}

export const updateFolder = async (
  userId: string,
  id: string,
  name: string
) => {
  const folder = await findOwnedFolder(userId, id)
  folder.name = name
  await folder.save()
  return folder
}

export const deleteFolder = async (userId: string, id: string) => {
  await findOwnedFolder(userId, id)
  await FolderModel.deleteOne({ _id: id, userId })
  await LectureModel.updateMany({ userId, folderId: id }, { folderId: null })
  return { message: 'Đã xóa thư mục' }
}
