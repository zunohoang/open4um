import { Router } from 'express'
import { requireAuth, requireUser } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'
import * as folderController from '@/controllers/folder.controller'
import {
  createFolderSchema,
  updateFolderSchema
} from '@/validators/folder.validator'

export const folderRouter = Router()

folderRouter.use(requireAuth, requireUser)
folderRouter.get('/', folderController.listFolders)
folderRouter.post(
  '/',
  validate(createFolderSchema),
  folderController.createFolder
)
folderRouter.patch(
  '/:id',
  validate(updateFolderSchema),
  folderController.updateFolder
)
folderRouter.delete('/:id', folderController.deleteFolder)
