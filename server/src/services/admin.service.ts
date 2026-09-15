import bcrypt from 'bcrypt'
import { AppError } from '@/utils/AppError'
import { UserModel } from '@/models/user.model'
import { LectureModel } from '@/models/lecture.model'
import { FolderModel } from '@/models/folder.model'
import { AiUsageLogModel } from '@/models/aiUsageLog.model'
import { CreditConfigModel } from '@/models/creditConfig.model'

export const listUsers = async (
  page: number,
  limit: number,
  search?: string
) => {
  const filter: Record<string, unknown> = {
    role: { $ne: 'admin' }
  }
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ]
  }
  const [items, total] = await Promise.all([
    UserModel.find(filter)
      .select('-passwordHash')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    UserModel.countDocuments(filter)
  ])
  return { items, total }
}

export const createUser = async (data: {
  name: string
  email: string
  password: string
  creditBalance?: number
}) => {
  const email = data.email.toLowerCase().trim()
  const existing = await UserModel.findOne({ email })
  if (existing) {
    throw new AppError('Email đã được sử dụng trong hệ thống', 409)
  }

  const creditConfig = await getCreditConfig()
  const creditBalance =
    typeof data.creditBalance === 'number'
      ? data.creditBalance
      : creditConfig.signupBonus

  const passwordHash = await bcrypt.hash(data.password, 10)
  const user = await UserModel.create({
    name: data.name.trim(),
    email,
    passwordHash,
    role: 'user',
    creditBalance
  })

  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    creditBalance: user.creditBalance,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  }
}

export const updateUser = async (
  id: string,
  data: { creditBalance: number }
) => {
  const user = await UserModel.findById(id).select('-passwordHash')
  if (!user) throw new AppError('Không tìm thấy người dùng', 404)
  if (user.role === 'admin') {
    throw new AppError('Không thể chỉnh sửa tài khoản quản trị viên', 403)
  }
  user.creditBalance = data.creditBalance
  await user.save()
  return user
}

export const lockUser = async (id: string) => {
  const user = await UserModel.findById(id).select('-passwordHash')
  if (!user) {
    throw new AppError('Không tìm thấy người dùng', 404)
  }
  if (user.role === 'admin') {
    throw new AppError('Không thể khóa tài khoản quản trị viên', 403)
  }

  const now = new Date()
  user.status = 'locked'
  user.lockedAt = now
  user.scheduledDeleteAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  await user.save()

  return user
}

export const restoreUser = async (id: string) => {
  const user = await UserModel.findById(id).select('-passwordHash')
  if (!user) {
    throw new AppError('Không tìm thấy người dùng', 404)
  }
  user.status = 'active'
  user.lockedAt = null
  user.scheduledDeleteAt = null
  await user.save()

  return user
}

export const deleteUser = async (id: string) => {
  const user = await UserModel.findById(id)
  if (!user) {
    throw new AppError('Không tìm thấy người dùng', 404)
  }
  if (user.role === 'admin') {
    throw new AppError('Không thể xóa tài khoản quản trị viên', 403)
  }

  await Promise.all([
    UserModel.findByIdAndDelete(id),
    LectureModel.deleteMany({ userId: id }),
    FolderModel.deleteMany({ userId: id }),
    AiUsageLogModel.deleteMany({ userId: id })
  ])

  return { id, message: 'Đã xóa người dùng thành công' }
}

export const cleanupExpiredLockedUsers = async () => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const expiredUsers = await UserModel.find({
    status: 'locked',
    $or: [
      { scheduledDeleteAt: { $ne: null, $lte: new Date() } },
      { lockedAt: { $ne: null, $lte: thirtyDaysAgo } }
    ]
  })

  if (expiredUsers.length === 0) return 0

  const userIds = expiredUsers.map((u) => u._id)
  await Promise.all([
    UserModel.deleteMany({ _id: { $in: userIds } }),
    LectureModel.deleteMany({ userId: { $in: userIds } }),
    FolderModel.deleteMany({ userId: { $in: userIds } })
  ])

  return expiredUsers.length
}

export const listAiUsage = async (
  page: number,
  limit: number,
  userId?: string,
  from?: string,
  to?: string
) => {
  const filter: Record<string, unknown> = {}
  if (userId) filter.userId = userId
  if (from || to) {
    filter.createdAt = {
      ...(from ? { $gte: new Date(from) } : {}),
      ...(to ? { $lte: new Date(`${to}T23:59:59.999Z`) } : {})
    }
  }
  const [items, total] = await Promise.all([
    AiUsageLogModel.find(filter)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    AiUsageLogModel.countDocuments(filter)
  ])
  return { items, total }
}

export const getCreditConfig = async () => {
  let config = await CreditConfigModel.findOne()
  if (!config) config = await CreditConfigModel.create({})
  return config
}

export const updateCreditConfig = async (data: {
  pricePerSlide?: number
  pricePerAiEdit?: number
  signupBonus?: number
}) => {
  const config = await getCreditConfig()
  Object.assign(config, data)
  await config.save()
  return config
}
