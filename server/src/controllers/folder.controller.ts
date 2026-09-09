import { asyncHandler } from '@/utils/asyncHandler'
import { ok } from '@/utils/response'
import * as folderService from '@/services/folder.service'

export const createFolder = asyncHandler(async (req, res) => {
  const folder = await folderService.createFolder(req.user.id, req.body.name)
  ok(res, folder, 201)
})

export const listFolders = asyncHandler(async (req, res) => {
  const folders = await folderService.listFolders(req.user.id)
  ok(res, folders)
})

export const updateFolder = asyncHandler(async (req, res) => {
  const folder = await folderService.updateFolder(
    req.user.id,
    String(req.params.id),
    req.body.name
  )
  ok(res, folder)
})

export const deleteFolder = asyncHandler(async (req, res) => {
  const result = await folderService.deleteFolder(
    req.user.id,
    String(req.params.id)
  )
  ok(res, result)
})
