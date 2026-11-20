import {
  Schema,
  model,
  type InferSchemaType,
  type HydratedDocument
} from 'mongoose'

const lectureSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    folderId: {
      type: Schema.Types.ObjectId,
      ref: 'Folder',
      default: null,
      index: true
    },
    title: { type: String, required: true, trim: true },
    revision: { type: Number, default: 0 },
    prompt: { type: String, default: '' },
    outline: { type: Schema.Types.Mixed, default: null },
    slides: { type: [Schema.Types.Mixed], default: [] },
    contextSummary: { type: String, default: '' },
    sourceMaterial: { type: String, default: '' },
    theme: { type: String, default: 'classic-editorial' },
    aiChatHistory: { type: [Schema.Types.Mixed], default: [] },
    deletedAt: {
      type: Date,
      default: null,
      index: {
        name: 'deletedAt_ttl_30d',
        expires: 30 * 24 * 60 * 60,
        partialFilterExpression: { deletedAt: { $type: 'date' } }
      }
    }
  },
  { timestamps: true }
)

export const LECTURE_QUERY_INDEXES = [
  {
    fields: { userId: 1, deletedAt: 1, createdAt: -1, _id: -1 },
    name: 'lecture_user_created'
  },
  {
    fields: { userId: 1, deletedAt: 1, folderId: 1, createdAt: -1, _id: -1 },
    name: 'lecture_folder_created'
  },
  {
    fields: { userId: 1, deletedAt: 1, updatedAt: -1, _id: -1 },
    name: 'lecture_user_updated'
  },
  { fields: { userId: 1, deletedAt: -1 }, name: 'lecture_user_trash' }
] as const

for (const { fields, name } of LECTURE_QUERY_INDEXES) {
  lectureSchema.index(fields, { name })
}

export type Lecture = InferSchemaType<typeof lectureSchema>
export type LectureDocument = HydratedDocument<Lecture>
export const LectureModel = model<Lecture>('Lecture', lectureSchema)
