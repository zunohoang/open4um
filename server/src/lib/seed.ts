import bcrypt from 'bcrypt'
import { UserModel } from '@/models/user.model'
import { CreditConfigModel } from '@/models/creditConfig.model'
import { logger } from '@/lib/logger'

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
  const email = (process.env.ADMIN_EMAIL ?? 'admin@abslider.com')
    .toLowerCase()
    .trim()
  const password = process.env.ADMIN_PASSWORD ?? 'admin123456'
  const name = process.env.ADMIN_NAME ?? 'Admin ABSlider'
  const creditBalance = Number(process.env.ADMIN_CREDIT_BALANCE) || 1000

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

    if (process.env.NODE_ENV === 'production') {
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
