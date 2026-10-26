import bcrypt from 'bcrypt'
import { Types } from 'mongoose'
import { AppError } from '@/utils/AppError'
import { escapeRegExp } from '@/utils/aiSlideMerge'
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
    // Tìm theo chuỗi nguyên văn: ký tự như ( + . không bị hiểu là regex
    const pattern = escapeRegExp(search)
    filter.$or = [
      { name: { $regex: pattern, $options: 'i' } },
      { email: { $regex: pattern, $options: 'i' } }
    ]
  }
  const [items, total] = await Promise.all([
    UserModel.find(filter)
      .select('-passwordHash')
      .sort({ createdAt: -1, _id: -1 })
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
  data: { name?: string; email?: string; creditBalance?: number }
) => {
  const user = await UserModel.findById(id).select('-passwordHash')
  if (!user) throw new AppError('Không tìm thấy người dùng', 404)
  if (user.role === 'admin') {
    throw new AppError('Không thể chỉnh sửa tài khoản quản trị viên', 403)
  }
  if (data.email !== undefined) {
    const email = data.email.toLowerCase().trim()
    // shortcut: kiểm tra trước khi lưu nên 2 request đồng thời cùng email có thể nhận 500 (E11000) thay vì 409, map mã 11000 sang 409 trong error.middleware nếu gặp thực tế
    const existing = await UserModel.findOne({ email, _id: { $ne: user._id } })
    if (existing) {
      throw new AppError('Email đã được sử dụng trong hệ thống', 409)
    }
    // shortcut: không báo cho địa chỉ email cũ nên admin (hoặc phiên admin bị lộ) có thể chiếm tài khoản qua "quên mật khẩu", gửi thông báo tới email cũ qua email.service nếu PO yêu cầu
    user.email = email
  }
  if (data.name !== undefined) user.name = data.name
  // shortcut: ghi số dư tuyệt đối nên credit người dùng tiêu trong lúc admin mở form sẽ bị ghi đè, chuyển sang $inc theo chênh lệch nếu cần
  if (data.creditBalance !== undefined) user.creditBalance = data.creditBalance
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

// Ngày dạng YYYY-MM-DD -> 00:00 UTC của ngày đó; ném 422 nếu sai định dạng hoặc ngày không tồn tại
const parseDate = (value: string, fieldName: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError(`${fieldName} phải có định dạng YYYY-MM-DD`, 422)
  }

  const date = new Date(`${value}T00:00:00.000Z`)
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new AppError(`${fieldName} không phải là ngày hợp lệ`, 422)
  }
  return date
}

export const listAiUsage = async (
  page: number,
  limit: number,
  userId?: string,
  from?: string,
  to?: string
) => {
  const fromDate = from ? parseDate(from, 'Từ ngày') : undefined
  const toDate = to ? parseDate(to, 'Đến ngày') : undefined
  if (fromDate && toDate && fromDate > toDate) {
    throw new AppError('Từ ngày không được sau Đến ngày', 422)
  }

  const filter: Record<string, unknown> = {}
  if (userId) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new AppError('Người dùng không hợp lệ', 422)
    }
    filter.userId = new Types.ObjectId(userId)
  }
  if (fromDate || toDate) {
    const toExclusive = toDate
      ? new Date(toDate.getTime() + 24 * 60 * 60 * 1000)
      : undefined
    filter.createdAt = {
      ...(fromDate ? { $gte: fromDate } : {}),
      ...(toExclusive ? { $lt: toExclusive } : {})
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

// Dashboard tính ngày theo giờ Việt Nam (UTC+7 cố định, không có giờ mùa hè)
const STATS_TIMEZONE = 'Asia/Ho_Chi_Minh'
const STATS_UTC_OFFSET_MS = 7 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_DASHBOARD_DAYS = 30
const MAX_DASHBOARD_DAYS = 366
const RECENT_ACTIVITY_LIMIT = 10

const toDateKey = (date: Date) => date.toISOString().slice(0, 10)
const sum = (values: number[]) =>
  values.reduce((total, value) => total + value, 0)

export const getDashboardStats = async (from?: string, to?: string) => {
  // Mặc định: 30 ngày gần nhất tính đến hôm nay (giờ Việt Nam)
  const toDate = parseDate(
    to ?? toDateKey(new Date(Date.now() + STATS_UTC_OFFSET_MS)),
    'Đến ngày'
  )
  const fromDate = from
    ? parseDate(from, 'Từ ngày')
    : new Date(toDate.getTime() - (DEFAULT_DASHBOARD_DAYS - 1) * DAY_MS)
  if (fromDate > toDate) {
    throw new AppError('Từ ngày không được sau Đến ngày', 422)
  }
  const dayCount = (toDate.getTime() - fromDate.getTime()) / DAY_MS + 1
  if (dayCount > MAX_DASHBOARD_DAYS) {
    throw new AppError(
      `Khoảng thời gian thống kê tối đa ${MAX_DASHBOARD_DAYS} ngày`,
      422
    )
  }

  // [00:00 giờ VN của ngày bắt đầu, 00:00 giờ VN của ngày sau ngày kết thúc)
  const createdAt = {
    $gte: new Date(fromDate.getTime() - STATS_UTC_OFFSET_MS),
    $lt: new Date(toDate.getTime() + DAY_MS - STATS_UTC_OFFSET_MS)
  }
  const byDay = {
    $dateToString: {
      format: '%Y-%m-%d',
      date: '$createdAt',
      timezone: STATS_TIMEZONE
    }
  }
  const aiTotals = {
    usages: { $sum: 1 },
    slides: { $sum: '$slideCount' },
    credits: { $sum: '$creditSpent' }
  }
  type DayCount = { _id: string; count: number }
  type AiTotals = {
    _id: string | null
    usages: number
    slides: number
    credits: number
  }

  const [
    userDays,
    lectureDays,
    aiDays,
    allUsers,
    allLectures,
    allAiRows,
    recentActivities
  ] = await Promise.all([
    UserModel.aggregate<DayCount>([
      { $match: { role: 'user', createdAt } },
      { $group: { _id: byDay, count: { $sum: 1 } } }
    ]),
    LectureModel.aggregate<DayCount>([
      { $match: { createdAt } },
      { $group: { _id: byDay, count: { $sum: 1 } } }
    ]),
    AiUsageLogModel.aggregate<AiTotals>([
      { $match: { createdAt } },
      { $group: { _id: byDay, ...aiTotals } }
    ]),
    UserModel.countDocuments({ role: 'user' }),
    LectureModel.countDocuments(),
    AiUsageLogModel.aggregate<AiTotals>([
      { $group: { _id: null, ...aiTotals } }
    ]),
    AiUsageLogModel.find({ createdAt })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(RECENT_ACTIVITY_LIMIT)
  ])

  const usersByDay = new Map(userDays.map((day) => [day._id, day.count]))
  const lecturesByDay = new Map(lectureDays.map((day) => [day._id, day.count]))
  const creditsByDay = new Map(aiDays.map((day) => [day._id, day.credits]))
  // Đủ mọi ngày trong khoảng, ngày không có dữ liệu = 0
  const series = Array.from({ length: dayCount }, (_, index) => {
    const date = toDateKey(new Date(fromDate.getTime() + index * DAY_MS))
    return {
      date,
      users: usersByDay.get(date) ?? 0,
      lectures: lecturesByDay.get(date) ?? 0,
      creditsSpent: creditsByDay.get(date) ?? 0
    }
  })
  const allAi = allAiRows[0]

  return {
    from: toDateKey(fromDate),
    to: toDateKey(toDate),
    totals: {
      users: sum(userDays.map((day) => day.count)),
      lectures: sum(lectureDays.map((day) => day.count)),
      aiUsages: sum(aiDays.map((day) => day.usages)),
      aiSlides: sum(aiDays.map((day) => day.slides)),
      creditsSpent: sum(aiDays.map((day) => day.credits))
    },
    allTime: {
      users: allUsers,
      lectures: allLectures,
      aiUsages: allAi?.usages ?? 0,
      aiSlides: allAi?.slides ?? 0,
      creditsSpent: allAi?.credits ?? 0
    },
    series,
    recentActivities
  }
}

export const getCreditConfig = async () => {
  let config = await CreditConfigModel.findOne()
  if (!config) config = await CreditConfigModel.create({})
  return config
}

export const updateCreditConfig = async (data: {
  pricePerLecture?: number
  pricePerSlide?: number
  pricePerAiEdit?: number
  pricePerOutline?: number
  signupBonus?: number
}) => {
  const config = await getCreditConfig()
  Object.assign(config, data)
  await config.save()
  return config
}
