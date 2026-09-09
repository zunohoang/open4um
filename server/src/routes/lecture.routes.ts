import { Router } from 'express'
import { requireAuth, requireUser } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'
import * as lectureController from '@/controllers/lecture.controller'
import {
  generateOutlineSchema,
  createLectureSchema,
  createBlankLectureSchema,
  updateLectureSchema,
  aiEditSlideSchema,
  slideOperationSchema
} from '@/validators/lecture.validator'

export const lectureRouter = Router()

lectureRouter.use(requireAuth, requireUser)
lectureRouter.post(
  '/generate-outline',
  validate(generateOutlineSchema),
  lectureController.generateOutline
)
lectureRouter.get('/trash', lectureController.listTrash)
lectureRouter.get('/', lectureController.listLectures)
lectureRouter.post(
  '/',
  validate(createLectureSchema),
  lectureController.createLecture
)
lectureRouter.post(
  '/blank',
  validate(createBlankLectureSchema),
  lectureController.createBlankLecture
)
lectureRouter.get('/:id', lectureController.getLecture)
lectureRouter.get('/:id/presentation', lectureController.getPresentation)
lectureRouter.patch(
  '/:id',
  validate(updateLectureSchema),
  lectureController.updateLecture
)
lectureRouter.patch(
  '/:id/autosave',
  validate(updateLectureSchema),
  lectureController.autosaveLecture
)
lectureRouter.post(
  '/:id/ai-edit',
  validate(aiEditSlideSchema),
  lectureController.editSlideWithAi
)
lectureRouter.post(
  '/:id/slides',
  validate(slideOperationSchema),
  lectureController.applySlideOperation
)
lectureRouter.post('/:id/duplicate', lectureController.duplicateLecture)
lectureRouter.delete('/:id', lectureController.deleteLecture)
lectureRouter.post('/:id/restore', lectureController.restoreLecture)
lectureRouter.post('/:id/export', lectureController.exportLecture)
