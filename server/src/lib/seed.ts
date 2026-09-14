import bcrypt from 'bcrypt'
import { UserModel } from '@/models/user.model'
import { CreditConfigModel } from '@/models/creditConfig.model'
import { logger } from '@/lib/logger'
import { DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD, env } from '@/config/env'

export const seedCreditConfig = async () => {
  let config = await CreditConfigModel.findOne()
  if (!config) {
    config = await CreditConfigModel.create({
      pricePerSlide: 10,
      pricePerAiEdit: 5,
      signupBonus: 100
    })
    logger.info('✅ Tạo cấu hình credit mặc định')
  }
  return config
}

export const seedAdmin = async () => {
  const email = env.ADMIN_EMAIL ?? DEFAULT_ADMIN_EMAIL
  const password = env.ADMIN_PASSWORD ?? DEFAULT_ADMIN_PASSWORD
  const name = env.ADMIN_NAME
  const creditBalance = env.ADMIN_CREDIT_BALANCE

  // Kiểm tra tài khoản admin với email chỉ định đã tồn tại chưa
  let admin = await UserModel.findOne({ email })
  if (admin) {
    if (admin.role !== 'admin') {
      admin.role = 'admin'
      await admin.save()
      logger.info({ email }, '✅ Tài khoản admin đã có trong csdl.')
    } else {
      logger.info(
        { email },
        '✅ Tài khoản admin đã tồn tại. Giữ nguyên thông tin.'
      )
    }
  } else {
    // Nếu chưa tồn tại tài khoản admin seed, khởi tạo mới
    const passwordHash = await bcrypt.hash(password, 10)
    admin = await UserModel.create({
      name,
      email,
      passwordHash,
      role: 'admin',
      creditBalance
    })

    if (env.NODE_ENV === 'production') {
      logger.warn(
        { email: admin.email },
        '⚠️ [CẢNH BÁO BẢO MẬT] Tài khoản admin khởi tạo đã được tạo trên môi trường production! Vui lòng đăng nhập và ĐỔI MẬT KHẨU ngay lập tức.'
      )
    } else {
      logger.info(
        { email: admin.email },
        '✅ Tài khoản admin khởi tạo đã được tạo. Vui lòng đổi mật khẩu mặc định sau khi đăng nhập.'
      )
    }
  }

  return admin
}

export const runSeed = async () => {
  await seedCreditConfig()
  await seedAdmin()
}
