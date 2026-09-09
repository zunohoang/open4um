import { Schema, model, type InferSchemaType } from 'mongoose'

const aiUsageLogSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    prompt: { type: String, required: true },
    slideCount: { type: Number, required: true },
    creditSpent: { type: Number, required: true }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

export type AiUsageLog = InferSchemaType<typeof aiUsageLogSchema>
export const AiUsageLogModel = model<AiUsageLog>('AiUsageLog', aiUsageLogSchema)
