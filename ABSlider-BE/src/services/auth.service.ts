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

const ACCESS_TOKEN_EXPIRES_IN = '15m'
const REFRESH_TOKEN_EXPIRES_IN = '7d'

const blacklistKey = (jti: string) => `blacklist:${jti}`

const signAccessToken = (id: string, role: Role) => {
  const payload: AccessTokenPayload = { id, role, type: 'access' }
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN
  })
}

const signRefreshToken = (id: string, role: Role) => {
  const payload: RefreshTokenPayload = {
    id,
    role,
    type: 'refresh',
    jti: crypto.randomUUID()
  }
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN
  })
}

const issueTokens = (id: string, role: Role) => ({
  accessToken: signAccessToken(id, role),
  refreshToken: signRefreshToken(id, role)
})

const toPublicUser = (user: UserDocument) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
  status: user.status,
  creditBalance: user.creditBalance
})

export const register = async (
  name: string,
  email: string,
  password: string
) => {
  const existing = await UserModel.findOne({ email })
  if (existing) throw new AppError('Email đã được sử dụng', 409)

  const passwordHash = await bcrypt.hash(password, 10)
  const creditConfig = await getCreditConfig()
  const user = await UserModel.create({
    name,
    email,
    passwordHash,
    creditBalance: creditConfig.signupBonus
  })
  return {
    user: toPublicUser(user),
    ...issueTokens(user._id.toString(), user.role as Role)
  }
}

export const login = async (email: string, password: string) => {
  const user = await UserModel.findOne({ email })
  if (!user) throw new AppError('Email hoặc mật khẩu không đúng', 401)

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) throw new AppError('Email hoặc mật khẩu không đúng', 401)

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
    ...issueTokens(user._id.toString(), user.role as Role)
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
  if (!user) throw new AppError('Tài khoản không tồn tại', 401)
  if (user.status === 'locked') {
    throw new AppError(
      'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên nếu có khiếu nại.',
      403
    )
  }

  return {
    accessToken: signAccessToken(user._id.toString(), user.role as Role)
  }
}

export const logout = async (refreshToken: string) => {
  try {
    const payload = jwt.verify(
      refreshToken,
      env.JWT_SECRET
    ) as RefreshTokenPayload
    if (payload.type === 'refresh') {
      await redis.set(blacklistKey(payload.jti), '1', 'EX', 7 * 24 * 60 * 60)
    }
  } catch {
    // token không hợp lệ thì coi như đã đăng xuất
  }
  return { message: 'Đăng xuất thành công' }
}

export const getProfile = async (userId: string) => {
  const user = await UserModel.findById(userId)
  if (!user) throw new AppError('Tài khoản không tồn tại', 404)
  return toPublicUser(user)
}

export const updateProfile = async (
  userId: string,
  name: string | undefined
) => {
  const user = await UserModel.findById(userId)
  if (!user) throw new AppError('Tài khoản không tồn tại', 404)
  if (name !== undefined) user.name = name
  await user.save()
  return toPublicUser(user)
}

export const changePassword = async (
  userId: string,
  oldPassword: string,
  newPassword: string
) => {
  const user = await UserModel.findById(userId)
  if (!user) throw new AppError('Tài khoản không tồn tại', 404)

  const valid = await bcrypt.compare(oldPassword, user.passwordHash)
  if (!valid) throw new AppError('Mật khẩu cũ không đúng', 400)

  user.passwordHash = await bcrypt.hash(newPassword, 10)
  await user.save()
  return { message: 'Đổi mật khẩu thành công' }
}
