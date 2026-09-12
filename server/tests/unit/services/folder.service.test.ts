import {
  createFolder,
  listFolders,
  updateFolder,
  deleteFolder
} from '@/services/folder.service'
import { FolderModel } from '@/models/folder.model'
import { LectureModel } from '@/models/lecture.model'

jest.mock('@/models/folder.model')
jest.mock('@/models/lecture.model')

describe('folder.service unit tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createFolder', () => {
    it('tạo thư mục thành công với userId và name', async () => {
      const mockCreated = {
        _id: 'f-1',
        userId: 'u-1',
        name: 'Thư mục Toán'
      }
      ;(FolderModel.create as jest.Mock).mockResolvedValue(mockCreated)

      const result = await createFolder('u-1', 'Thư mục Toán')

      expect(result).toEqual(mockCreated)
      expect(FolderModel.create).toHaveBeenCalledWith({
        userId: 'u-1',
        name: 'Thư mục Toán'
      })
    })
  })

  describe('listFolders', () => {
    it('lấy danh sách thư mục của người dùng sắp xếp giảm dần theo thời gian tạo', async () => {
      const mockFolders = [
        { _id: 'f-1', userId: 'u-1', name: 'Thư mục 1' },
        { _id: 'f-2', userId: 'u-1', name: 'Thư mục 2' }
      ]
      const mockSort = jest.fn().mockResolvedValue(mockFolders)
      ;(FolderModel.find as jest.Mock).mockReturnValue({ sort: mockSort })

      const result = await listFolders('u-1')

      expect(result).toEqual(mockFolders)
      expect(FolderModel.find).toHaveBeenCalledWith({ userId: 'u-1' })
      expect(mockSort).toHaveBeenCalledWith({ createdAt: -1 })
    })
  })

  describe('updateFolder', () => {
    it('ném lỗi 404 khi không tìm thấy thư mục thuộc quyền sở hữu của user', async () => {
      ;(FolderModel.findOne as jest.Mock).mockResolvedValue(null)

      await expect(
        updateFolder('u-1', 'f-999', 'Tên mới')
      ).rejects.toMatchObject({
        statusCode: 404,
        message: expect.stringContaining('Không tìm thấy thư mục')
      })
    })

    it('cập nhật tên thư mục thành công khi tìm thấy', async () => {
      const mockFolder = {
        _id: 'f-1',
        userId: 'u-1',
        name: 'Tên cũ',
        save: jest.fn().mockResolvedValue(true)
      }
      ;(FolderModel.findOne as jest.Mock).mockResolvedValue(mockFolder)

      const result = await updateFolder('u-1', 'f-1', 'Tên mới')

      expect(result.name).toBe('Tên mới')
      expect(mockFolder.save).toHaveBeenCalled()
    })
  })

  describe('deleteFolder', () => {
    it('ném lỗi 404 khi không tìm thấy thư mục cần xóa', async () => {
      ;(FolderModel.findOne as jest.Mock).mockResolvedValue(null)

      await expect(deleteFolder('u-1', 'f-999')).rejects.toMatchObject({
        statusCode: 404,
        message: expect.stringContaining('Không tìm thấy thư mục')
      })
    })

    it('xóa thư mục thành công và gỡ folderId ở các bài giảng liên quan', async () => {
      const mockFolder = { _id: 'f-1', userId: 'u-1', name: 'Thư mục A' }
      ;(FolderModel.findOne as jest.Mock).mockResolvedValue(mockFolder)
      ;(FolderModel.deleteOne as jest.Mock).mockResolvedValue({
        deletedCount: 1
      })
      ;(LectureModel.updateMany as jest.Mock).mockResolvedValue({
        modifiedCount: 3
      })

      const result = await deleteFolder('u-1', 'f-1')

      expect(result).toEqual({ message: 'Đã xóa thư mục' })
      expect(FolderModel.deleteOne).toHaveBeenCalledWith({
        _id: 'f-1',
        userId: 'u-1'
      })
      expect(LectureModel.updateMany).toHaveBeenCalledWith(
        { userId: 'u-1', folderId: 'f-1' },
        { folderId: null }
      )
    })
  })
})
