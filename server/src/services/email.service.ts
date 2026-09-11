import { Resend } from 'resend'
import { env } from '@/config/env'
import { logger } from '@/lib/logger'
import { AppError } from '@/utils/AppError'

const getResendClient = () => new Resend(env.RESEND_API_KEY)

const renderEmailTemplate = ({
  title,
  subtitle,
  otp,
  instruction,
  warning
}: {
  title: string
  subtitle: string
  otp: string
  instruction: string
  warning: string
}) => `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f5f5f4;color:#1c1917;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="min-width:100%;background-color:#f5f5f4;padding:40px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:540px;background-color:#ffffff;border:1px solid #e7e5e4;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="background-color:#022c22;padding:28px 36px;text-align:left;">
              <span style="font-size:11px;font-weight:700;letter-spacing:2px;color:#fdba74;text-transform:uppercase;">ABSLIDER / STUDIO</span>
              <h1 style="margin:10px 0 0 0;font-size:22px;color:#ffffff;font-weight:600;line-height:1.3;">${title}</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px;background-color:#ffffff;">
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#44403c;">${subtitle}</p>
              <p style="margin:0 0 24px 0;font-size:14px;line-height:1.6;color:#78716c;">${instruction}</p>

              <!-- OTP Box -->
              <div style="text-align:center;margin:32px 0;">
                <div style="display:inline-block;padding:16px 36px;background-color:#fff7ed;border:2px dashed #ea580c;border-radius:8px;">
                  <span style="font-family:'Courier New',Courier,monospace;font-size:36px;font-weight:800;letter-spacing:10px;color:#c2410c;">${otp}</span>
                </div>
                <p style="margin:12px 0 0 0;font-size:13px;color:#9a3412;font-weight:600;">Mã có hiệu lực trong vòng 5 phút</p>
              </div>

              <div style="background-color:#fafaf9;border-left:4px solid #ea580c;padding:14px 16px;margin-top:28px;">
                <p style="margin:0;font-size:13px;color:#57534e;line-height:1.5;">${warning}</p>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 36px;background-color:#f5f5f4;border-top:1px solid #e7e5e4;text-align:center;">
              <p style="margin:0;font-size:12px;color:#a8a29e;line-height:1.5;">
                Email này được gửi tự động từ hệ thống ABSlider. Nếu bạn không gửi yêu cầu này, vui lòng bỏ qua email hoặc thông báo với bộ phận hỗ trợ.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

export const sendRegisterOtp = async (
  to: string,
  otp: string
): Promise<void> => {
  try {
    const html = renderEmailTemplate({
      title: 'Xác thực tài khoản ABSlider',
      subtitle: `Chào mừng bạn đến với ABSlider! Chúng tôi đã nhận được yêu cầu đăng ký tài khoản cho địa chỉ email: <strong>${to}</strong>.`,
      otp,
      instruction:
        'Vui lòng nhập mã xác thực OTP 6 chữ số dưới đây để hoàn tất thủ tục đăng ký tài khoản:',
      warning:
        'Lưu ý: Không chia sẻ mã OTP này với bất kỳ ai để bảo vệ an toàn cho tài khoản của bạn.'
    })

    const resend = getResendClient()
    const { error } = await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to,
      subject: `[ABSlider] Mã xác thực đăng ký: ${otp}`,
      html
    })

    if (error) {
      logger.error(
        { err: error, to },
        '❌ Gửi email OTP đăng ký qua Resend thất bại'
      )
      throw new AppError(
        'Không thể gửi mã xác thực qua email. Vui lòng thử lại sau',
        500
      )
    }

    logger.info({ to }, '✅ Đã gửi email OTP đăng ký thành công')
  } catch (err) {
    if (err instanceof AppError) throw err
    logger.error({ err, to }, '❌ Lỗi hệ thống khi gửi email OTP đăng ký')
    throw new AppError(
      'Không thể gửi mã xác thực qua email. Vui lòng thử lại sau',
      500
    )
  }
}

export const sendForgotPasswordOtp = async (
  to: string,
  otp: string
): Promise<void> => {
  try {
    const html = renderEmailTemplate({
      title: 'Đặt lại mật khẩu ABSlider',
      subtitle: `Hệ thống vừa nhận được yêu cầu đặt lại mật khẩu cho tài khoản liên kết với email: <strong>${to}</strong>.`,
      otp,
      instruction:
        'Nhập mã OTP xác nhận dưới đây để tiến hành thiết lập mật khẩu mới:',
      warning:
        'Cảnh báo an toàn: Nếu bạn không thực hiện yêu cầu này, có thể ai đó đang cố gắng truy cập tài khoản của bạn. Hãy đảm bảo mật khẩu hiện tại vẫn an toàn.'
    })

    const resend = getResendClient()
    const { error } = await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to,
      subject: `[ABSlider] Mã xác thực đặt lại mật khẩu: ${otp}`,
      html
    })

    if (error) {
      logger.error(
        { err: error, to },
        '❌ Gửi email OTP đặt lại mật khẩu qua Resend thất bại'
      )
      throw new AppError(
        'Không thể gửi mã xác thực đặt lại mật khẩu. Vui lòng thử lại sau',
        500
      )
    }

    logger.info({ to }, '✅ Đã gửi email OTP đặt lại mật khẩu thành công')
  } catch (err) {
    if (err instanceof AppError) throw err
    logger.error(
      { err, to },
      '❌ Lỗi hệ thống khi gửi email OTP đặt lại mật khẩu'
    )
    throw new AppError(
      'Không thể gửi mã xác thực đặt lại mật khẩu. Vui lòng thử lại sau',
      500
    )
  }
}
