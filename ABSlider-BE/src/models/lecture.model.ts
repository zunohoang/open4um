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
    prompt: { type: String, default: '' },
    pattern: { type: String, default: 'default' },
    slides: { type: [Schema.Types.Mixed], default: [] },
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

export type Lecture = InferSchemaType<typeof lectureSchema>
export type LectureDocument = HydratedDocument<Lecture>
export const LectureModel = model<Lecture>('Lecture', lectureSchema)
