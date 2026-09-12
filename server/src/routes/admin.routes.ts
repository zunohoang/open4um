import { Router } from 'express'
import { requireAuth, requireAdmin } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'
import * as adminController from '@/controllers/admin.controller'
import {
  createUserSchema,
  updateUserSchema,
  updateCreditConfigSchema
} from '@/validators/admin.validator'

export const adminRouter = Router()

adminRouter.use(requireAuth, requireAdmin)
adminRouter.get('/users', adminController.listUsers)
adminRouter.post(
  '/users',
  validate(createUserSchema),
  adminController.createUser
)
adminRouter.patch(
  '/users/:id',
  validate(updateUserSchema),
  adminController.updateUser
)
adminRouter.patch('/users/:id/lock', adminController.lockUser)
adminRouter.patch('/users/:id/restore', adminController.restoreUser)
adminRouter.delete('/users/:id', adminController.deleteUser)

adminRouter.get('/ai-usage', adminController.listAiUsage)
adminRouter.get('/credit-config', adminController.getCreditConfig)
adminRouter.patch(
  '/credit-config',
  validate(updateCreditConfigSchema),
  adminController.updateCreditConfig
)
