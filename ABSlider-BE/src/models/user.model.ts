import {
  Schema,
  model,
  type InferSchemaType,
  type HydratedDocument
} from 'mongoose'

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'] as const, default: 'user' },
    status: {
      type: String,
      enum: ['active', 'locked'] as const,
      default: 'active'
    },
    lockedAt: { type: Date, default: null },
    scheduledDeleteAt: { type: Date, default: null },
    creditBalance: { type: Number, default: 100 }
  },
  { timestamps: true }
)

export type User = InferSchemaType<typeof userSchema>
export type UserDocument = HydratedDocument<User>
export const UserModel = model<User>('User', userSchema)
