import { Router } from 'express'
import { requireAuth } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'
import * as authController from '@/controllers/auth.controller'
import {
  sendRegisterOtpSchema,
  registerSchema,
  loginSchema,
  refreshSchema,
  updateProfileSchema,
  changePasswordSchema,
  forgotPasswordSchema
} from '@/validators/auth.validator'

export const authRouter = Router()

authRouter.post(
  '/send-register-otp',
  validate(sendRegisterOtpSchema),
  authController.sendRegisterOtp
)
authRouter.post('/register', validate(registerSchema), authController.register)
authRouter.post(
  '/forgot-password',
  validate(forgotPasswordSchema),
  authController.forgotPassword
)
authRouter.post('/login', validate(loginSchema), authController.login)
authRouter.post('/refresh', validate(refreshSchema), authController.refresh)
authRouter.post('/logout', validate(refreshSchema), authController.logout)
authRouter.get('/me', requireAuth, authController.me)
authRouter.patch(
  '/profile',
  requireAuth,
  validate(updateProfileSchema),
  authController.updateProfile
)
authRouter.patch(
  '/change-password',
  requireAuth,
  validate(changePasswordSchema),
  authController.changePassword
)
