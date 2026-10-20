import { UserModel } from '@/models/user.model'
import { AppError } from '@/utils/AppError'

export const debitCredits = async (
  userId: string,
  amount: number,
  insufficientMessage: string
) => {
  const user = await UserModel.findOneAndUpdate(
    { _id: userId, creditBalance: { $gte: amount } },
    { $inc: { creditBalance: -amount } },
    { new: true }
  )

  if (!user) throw new AppError(insufficientMessage, 402)
  return user.creditBalance
}

export const refundCredits = async (userId: string, amount: number) => {
  await UserModel.updateOne(
    { _id: userId },
    { $inc: { creditBalance: amount } }
  )
}
