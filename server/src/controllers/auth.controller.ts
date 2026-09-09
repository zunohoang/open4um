import { asyncHandler } from '@/utils/asyncHandler'
import { ok } from '@/utils/response'
import * as authService from '@/services/auth.service'

export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body
  const result = await authService.register(name, email, password)
  ok(res, result, 201)
})

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body
  const result = await authService.login(email, password)
  ok(res, result)
})

export const refresh = asyncHandler(async (req, res) => {
  const result = await authService.refresh(req.body.refreshToken)
  ok(res, result)
})

export const logout = asyncHandler(async (req, res) => {
  const result = await authService.logout(req.body.refreshToken)
  ok(res, result)
})

export const me = asyncHandler(async (req, res) => {
  const result = await authService.getProfile(req.user.id)
  ok(res, result)
})

export const updateProfile = asyncHandler(async (req, res) => {
  const result = await authService.updateProfile(req.user.id, req.body.name)
  ok(res, result)
})

export const changePassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body
  const result = await authService.changePassword(
    req.user.id,
    oldPassword,
    newPassword
  )
  ok(res, result)
})
