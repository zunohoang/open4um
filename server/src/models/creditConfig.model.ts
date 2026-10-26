import {
  Schema,
  model,
  type InferSchemaType,
  type SchemaTypeOptions
} from 'mongoose'

const positiveIntegerField = (
  defaultValue: number
): SchemaTypeOptions<number> => ({
  type: Number,
  required: true,
  default: defaultValue,
  min: [1, 'Mức credit phải lớn hơn 0'],
  validate: {
    validator: Number.isInteger,
    message: 'Mức credit phải là số nguyên'
  }
})

const creditConfigSchema = new Schema(
  {
    pricePerLecture: positiveIntegerField(80),
    pricePerSlide: positiveIntegerField(10),
    pricePerAiEdit: positiveIntegerField(5),
    pricePerOutline: positiveIntegerField(5),
    signupBonus: positiveIntegerField(100)
  },
  { timestamps: true }
)

export type CreditConfig = InferSchemaType<typeof creditConfigSchema>
export const CreditConfigModel = model<CreditConfig>(
  'CreditConfig',
  creditConfigSchema
)
