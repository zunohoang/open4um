import {
  Schema,
  model,
  type InferSchemaType,
  type HydratedDocument
} from 'mongoose'

const folderSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    name: { type: String, required: true, trim: true }
  },
  { timestamps: true }
)

export type Folder = InferSchemaType<typeof folderSchema>
export type FolderDocument = HydratedDocument<Folder>
export const FolderModel = model<Folder>('Folder', folderSchema)
