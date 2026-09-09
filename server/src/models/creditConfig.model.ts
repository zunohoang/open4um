import { Schema, model, type InferSchemaType } from 'mongoose'

const creditConfigSchema = new Schema(
  {
    pricePerSlide: { type: Number, default: 10 },
    pricePerAiEdit: { type: Number, default: 5 },
    signupBonus: { type: Number, default: 100 }
  },
  { timestamps: true }
)

export type CreditConfig = InferSchemaType<typeof creditConfigSchema>
export const CreditConfigModel = model<CreditConfig>(
  'CreditConfig',
  creditConfigSchema
)
