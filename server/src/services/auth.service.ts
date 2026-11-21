import crypto from 'node:crypto'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { env } from '@/config/env'
import { redis } from '@/lib/redis'
import { AppError } from '@/utils/AppError'
import { UserModel, type UserDocument } from '@/models/user.model'
import type {
  AccessTokenPayload,
  RefreshTokenPayload,
  Role
} from '@/types/auth.types'
import { getCreditConfig } from '@/services/admin.service'
import * as emailService from '@/services/email.service'
import { uploadImage } from '@/lib/storage'

const ACCESS_TOKEN_EXPIRES_IN = '15m'
const REFRESH_TOKEN_EXPIRES_IN = '7d'
const OTP_TTL_SECONDS = 300 // 5 phút
const OTP_COOLDOWN_SECONDS = 60 // 1 phút

const blacklistKey = (jti: string) => `blacklist:${jti}`
const registerOtpKey = (email: string) => `otp:register:${email.toLowerCase()}`
const registerCooldownKey = (email: string) =>
  `otp:cooldown:register:${email.toLowerCase()}`
const forgotPasswordOtpKey = (email: string) =>
  `otp:forgot:${email.toLowerCase()}`
const forgotPasswordCooldownKey = (email: string) =>
  `otp:cooldown:forgot:${email.toLowerCase()}`

export const PROFILE_UPDATE_COOLDOWN_SECONDS = 60 // Cooldown 60s giữa 2 lần cập nhật
export const PROFILE_UPDATE_WINDOW_SECONDS = 3600 // Khung thời gian 1 giờ
export const PROFILE_UPDATE_MAX_PER_WINDOW = 5 // Tối đa 5 lần trong 1 giờ

export const profileCooldownKey = (userId: string) =>
  `ratelimit:profile:cooldown:${userId}`
export const profileCountKey = (userId: string) =>
  `ratelimit:profile:count:${userId}`

// Reserve attempts atomically so parallel submissions share one fixed window.
async function reserveAttempt(
  kind: string,
  email: string,
  limit: number,
  seconds: number
) {
  const key = `ratelimit:${kind}:${email.trim().toLowerCase()}`
  const count = await redis.eval(
    "local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end; return n",
    1,
    key,
    seconds
  )
  if (Number(count) > limit)
    throw new AppError(
      'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau ' +
        Math.ceil(seconds / 60) +
        ' phút.',
      429
    )
  return key
}

const generateOtp = (): string => {
  return crypto.randomInt(100000, 1000000).toString()
}

const signAccessToken = (
  id: string,
  role: Role,
  sessionId: string,
  tokenVersion: number
) => {
  const payload: AccessTokenPayload = {
    id,
    role,
    type: 'access',
    sessionId,
    tokenVersion
  }
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN
  })
}

const signRefreshToken = (
  id: string,
  role: Role,
  sessionId: string,
  tokenVersion: number
) => {
  const payload: RefreshTokenPayload = {
    id,
    role,
    type: 'refresh',
    jti: sessionId,
    tokenVersion
  }
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN
  })
}

const issueTokens = (id: string, role: Role, tokenVersion = 0) => {
  const sessionId = crypto.randomUUID()
  return {
    accessToken: signAccessToken(id, role, sessionId, tokenVersion),
    refreshToken: signRefreshToken(id, role, sessionId, tokenVersion)
  }
}

const toPublicUser = (user: UserDocument) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
  status: user.status,
  creditBalance: user.creditBalance,
  avatar: user.avatar || null
})

export const sendRegisterOtp = async (email: string) => {
  const normalizedEmail = email.toLowerCase().trim()
  const existing = await UserModel.findOne({ email: normalizedEmail })
  if (existing) throw new AppError('Email đã được sử dụng', 409)

  const cooldown = await redis.get(registerCooldownKey(normalizedEmail))
  if (cooldown) {
    throw new AppError('Vui lòng đợi 60 giây trước khi gửi lại mã OTP', 429)
  }

  const otp = generateOtp()
  await redis.set(registerOtpKey(normalizedEmail), otp, 'EX', OTP_TTL_SECONDS)
  await redis.set(
    registerCooldownKey(normalizedEmail),
    '1',
    'EX',
    OTP_COOLDOWN_SECONDS
  )

  await emailService.sendRegisterOtp(normalizedEmail, otp)

  return { message: 'Mã xác thực đã được gửi đến email của bạn' }
}

export const register = async (
  name: string,
  email: string,
  password: string,
  otp?: string
) => {
  const normalizedEmail = email.toLowerCase().trim()
  const existing = await UserModel.findOne({ email: normalizedEmail })
  if (existing) throw new AppError('Email đã được sử dụng', 409)

  if (env.ENABLE_EMAIL_VERIFICATION) {
    const attempts = await reserveAttempt(
      'register-otp',
      normalizedEmail,
      5,
      OTP_TTL_SECONDS
    )
    const storedOtp = await redis.get(registerOtpKey(normalizedEmail))
    if (!storedOtp || storedOtp !== otp) {
      throw new AppError('Mã OTP không chính xác hoặc đã hết hạn', 400)
    }
    await redis.del(attempts)
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const creditConfig = await getCreditConfig()
  const user = await UserModel.create({
    name,
    email: normalizedEmail,
    passwordHash,
    creditBalance: creditConfig.signupBonus
  })
  if (env.ENABLE_EMAIL_VERIFICATION) {
    await redis.del(registerOtpKey(normalizedEmail))
    await redis.del(registerCooldownKey(normalizedEmail))
  }

  return {
    user: toPublicUser(user),
    ...issueTokens(
      user._id.toString(),
      user.role as Role,
      user.tokenVersion ?? 0
    )
  }
}

export const login = async (email: string, password: string) => {
  const attempts = await reserveAttempt('login', email, 7, 15 * 60)
  const user = await UserModel.findOne({ email: email.trim().toLowerCase() })
  if (!user) throw new AppError('Email hoặc mật khẩu không chính xác', 401)

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) throw new AppError('Email hoặc mật khẩu không chính xác', 401)

  await redis.del(attempts)
  if (user.status === 'locked') {
    const lockedAt = user.lockedAt || user.updatedAt || new Date()
    const daysPassed = Math.floor(
      (Date.now() - new Date(lockedAt).getTime()) / (24 * 60 * 60 * 1000)
    )
    const remainingDays = Math.max(1, 30 - daysPassed)
    throw new AppError(
      `Tài khoản của bạn đã bị khóa và sẽ bị xóa vĩnh viễn sau ${remainingDays} ngày. Vui lòng liên hệ quản trị viên nếu có khiếu nại.`,
      403
    )
  }

  return {
    user: toPublicUser(user),
    ...issueTokens(
      user._id.toString(),
      user.role as Role,
      user.tokenVersion ?? 0
    )
  }
}

export const refresh = async (refreshToken: string) => {
  let payload: RefreshTokenPayload
  try {
    payload = jwt.verify(refreshToken, env.JWT_SECRET) as RefreshTokenPayload
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError(
        'Refresh token đã hết hạn, vui lòng đăng nhập lại',
        401
      )
    }
    throw new AppError('Refresh token không hợp lệ', 401)
  }
  if (payload.type !== 'refresh')
    throw new AppError('Refresh token không hợp lệ', 401)

  const blacklisted = await redis.get(blacklistKey(payload.jti))
  if (blacklisted) throw new AppError('Refresh token đã bị thu hồi', 401)

  const user = await UserModel.findById(payload.id)
  if (!user || (payload.tokenVersion ?? 0) !== (user.tokenVersion ?? 0))
    throw new AppError(
      'Phiên làm việc đã bị thu hồi. Vui lòng đăng nhập lại.',
      401
    )
  if (user.status === 'locked') {
    throw new AppError(
      'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên nếu có khiếu nại.',
      403
    )
  }

  return {
    accessToken: signAccessToken(
      user._id.toString(),
      user.role as Role,
      payload.jti,
      user.tokenVersion ?? 0
    )
  }
}

export const logout = async (refreshToken: string, accessToken?: string) => {
  if (accessToken) {
    const hash = crypto.createHash('sha256').update(accessToken).digest('hex')
    await redis.set(`blacklist:access:${hash}`, '1', 'EX', 15 * 60)
  }
  let payload: RefreshTokenPayload
  try {
    payload = jwt.verify(refreshToken, env.JWT_SECRET) as RefreshTokenPayload
  } catch {
    return { message: 'Đăng xuất thành công' }
  }
  if (payload.type === 'refresh') {
    await redis.set(blacklistKey(payload.jti), '1', 'EX', 7 * 24 * 60 * 60)
  }
  return { message: 'Đăng xuất thành công' }
}

export const getProfile = async (userId: string) => {
  const user = await UserModel.findById(userId)
  if (!user) throw new AppError('Tài khoản không tồn tại', 404)
  const [shortTtl, count, windowTtl] = await Promise.all([
    redis.ttl(profileCooldownKey(userId)),
    redis.get(profileCountKey(userId)),
    redis.ttl(profileCountKey(userId))
  ])
  return {
    ...toPublicUser(user),
    profileCooldownSeconds: Math.max(
      0,
      shortTtl,
      Number(count) >= PROFILE_UPDATE_MAX_PER_WINDOW ? windowTtl : 0
    )
  }
}

export interface UpdateProfileInput {
  name?: string
  avatar?: string | null
}

export const updateProfile = async (
  userId: string,
  data: string | UpdateProfileInput
) => {
  const user = await UserModel.findById(userId)
  if (!user) throw new AppError('Tài khoản không tồn tại', 404)

  const { name, avatar } =
    typeof data === 'string' ? { name: data, avatar: undefined } : data

  // Luồng 5b: Trường Họ tên bị bỏ trống -> Thông báo "Họ tên không được để trống"
  if (name !== undefined) {
    const trimmed = name.trim()
    if (trimmed.length < 2) {
      throw new AppError('Họ tên phải có ít nhất 2 ký tự', 400)
    }
  }

  // Luồng 5a: Ảnh vượt quá dung lượng cho phép hoặc sai định dạng -> Thông báo lỗi tệp tin
  if (avatar) {
    if (
      !avatar.startsWith('data:') &&
      !avatar.startsWith('http://') &&
      !avatar.startsWith('https://') &&
      !avatar.startsWith('/')
    ) {
      throw new AppError(
        'Ảnh vượt quá dung lượng cho phép hoặc sai định dạng tệp tin',
        400
      )
    }
  }

  const trimmedName = name?.trim()
  const nameChanged = trimmedName !== undefined && trimmedName !== user.name
  const avatarChanged = avatar !== undefined && avatar !== user.avatar

  // Nếu không có thay đổi nào so với hiện tại
  if (!nameChanged && !avatarChanged) {
    return toPublicUser(user)
  }

  // 1. Kiểm tra cooldown chống spam liên tục giữa 2 lần cập nhật (mặc định 60s)
  const cooldown = await redis.get(profileCooldownKey(userId))
  if (cooldown) {
    const ttl = await redis.ttl(profileCooldownKey(userId))
    const remaining = ttl > 0 ? ttl : PROFILE_UPDATE_COOLDOWN_SECONDS
    throw new AppError(
      `Bạn đang cập nhật quá nhanh. Vui lòng đợi ${remaining} giây trước khi thử lại.`,
      429
    )
  }

  // 2. Kiểm tra giới hạn số lần cập nhật trong 1 giờ (tối đa 5 lần)
  const currentCountStr = await redis.get(profileCountKey(userId))
  const currentCount = currentCountStr ? parseInt(currentCountStr, 10) : 0
  if (currentCount >= PROFILE_UPDATE_MAX_PER_WINDOW) {
    const ttl = await redis.ttl(profileCountKey(userId))
    const remainingMinutes = Math.ceil(
      (ttl > 0 ? ttl : PROFILE_UPDATE_WINDOW_SECONDS) / 60
    )
    throw new AppError(
      `Bạn đã thay đổi thông tin cá nhân quá nhiều lần (tối đa ${PROFILE_UPDATE_MAX_PER_WINDOW} lần/giờ). Vui lòng thử lại sau ${remainingMinutes} phút.`,
      429
    )
  }

  // 3. Cập nhật thông tin mới vào CSDL
  if (nameChanged && trimmedName) {
    user.name = trimmedName
  }
  if (avatarChanged) {
    user.avatar = avatar?.startsWith('data:')
      ? '/api/v1/media/' +
        (await uploadImage(userId, avatar, 2 * 1024 * 1024)).key
      : avatar || null
  }
  await user.save()

  // 4. Thiết lập cooldown và tăng bộ đếm lượt thay đổi trong Redis
  await redis.set(
    profileCooldownKey(userId),
    '1',
    'EX',
    PROFILE_UPDATE_COOLDOWN_SECONDS
  )
  const newCount = await redis.incr(profileCountKey(userId))
  if (newCount === 1) {
    await redis.expire(profileCountKey(userId), PROFILE_UPDATE_WINDOW_SECONDS)
  }

  return {
    ...toPublicUser(user),
    profileCooldownSeconds:
      newCount >= PROFILE_UPDATE_MAX_PER_WINDOW
        ? Math.max(
            PROFILE_UPDATE_COOLDOWN_SECONDS,
            await redis.ttl(profileCountKey(userId))
          )
        : PROFILE_UPDATE_COOLDOWN_SECONDS
  }
}

export const changePassword = async (
  userId: string,
  oldPassword: string,
  newPassword: string
) => {
  const user = await UserModel.findById(userId)
  if (!user) throw new AppError('Tài khoản không tồn tại', 404)

  const valid = await bcrypt.compare(oldPassword, user.passwordHash)
  if (!valid) throw new AppError('Mật khẩu hiện tại không đúng', 400)

  user.passwordHash = await bcrypt.hash(newPassword, 10)
  user.tokenVersion = (user.tokenVersion ?? 0) + 1
  await user.save()
  return {
    message: 'Đổi mật khẩu thành công',
    ...issueTokens(user._id.toString(), user.role as Role, user.tokenVersion)
  }
}

export const forgotPassword = async (email: string) => {
  const normalizedEmail = email.toLowerCase().trim()
  const user = await UserModel.findOne({ email: normalizedEmail })
  if (!user) {
    throw new AppError(
      'Tài khoản với email này không tồn tại trong hệ thống',
      404
    )
  }

  if (user.status === 'locked') {
    throw new AppError(
      'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.',
      403
    )
  }

  const cooldown = await redis.get(forgotPasswordCooldownKey(normalizedEmail))
  if (cooldown) {
    throw new AppError('Vui lòng đợi 60 giây trước khi yêu cầu lại mã OTP', 429)
  }

  const otp = generateOtp()
  await redis.set(
    forgotPasswordOtpKey(normalizedEmail),
    otp,
    'EX',
    OTP_TTL_SECONDS
  )
  await redis.set(
    forgotPasswordCooldownKey(normalizedEmail),
    '1',
    'EX',
    OTP_COOLDOWN_SECONDS
  )

  await emailService.sendForgotPasswordOtp(normalizedEmail, otp)

  return {
    message: 'Mã xác thực đặt lại mật khẩu đã được gửi đến email của bạn'
  }
}

export const resetPassword = async (
  email: string,
  otp: string,
  password: string
) => {
  const normalizedEmail = email.toLowerCase().trim()
  const user = await UserModel.findOne({ email: normalizedEmail })
  if (!user) {
    throw new AppError(
      'Tài khoản với email này không tồn tại trong hệ thống',
      404
    )
  }

  if (user.status === 'locked') {
    throw new AppError(
      'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.',
      403
    )
  }

  const attempts = await reserveAttempt(
    'reset-otp',
    normalizedEmail,
    5,
    OTP_TTL_SECONDS
  )
  const storedOtp = await redis.get(forgotPasswordOtpKey(normalizedEmail))
  if (!storedOtp || storedOtp !== otp) {
    throw new AppError('Mã OTP không chính xác hoặc đã hết hạn', 400)
  }

  user.passwordHash = await bcrypt.hash(password, 10)
  user.tokenVersion = (user.tokenVersion ?? 0) + 1
  await user.save()

  await redis.del(forgotPasswordOtpKey(normalizedEmail))
  await redis.del(attempts)

  return { message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.' }
}
