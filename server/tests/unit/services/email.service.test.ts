import {
  sendRegisterOtp,
  sendForgotPasswordOtp
} from '@/services/email.service'

const mockEmailsSend = jest.fn()

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: (...args: any[]) => mockEmailsSend(...args)
    }
  }))
}))

describe('email.service unit tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('sendRegisterOtp', () => {
    it('gửi email thành công qua Resend', async () => {
      mockEmailsSend.mockResolvedValue({
        data: { id: 'email-123' },
        error: null
      })

      await expect(
        sendRegisterOtp('user@example.com', '123456')
      ).resolves.toBeUndefined()

      expect(mockEmailsSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: expect.stringContaining('123456')
        })
      )
    })

    it('ném lỗi 500 khi Resend trả về lỗi API', async () => {
      mockEmailsSend.mockResolvedValue({
        data: null,
        error: { message: 'Invalid API Key' }
      })

      await expect(
        sendRegisterOtp('user@example.com', '123456')
      ).rejects.toMatchObject({
        statusCode: 500,
        message: expect.stringContaining('Không thể gửi mã xác thực')
      })
    })
  })

  describe('sendForgotPasswordOtp', () => {
    it('gửi email OTP quên mật khẩu thành công qua Resend', async () => {
      mockEmailsSend.mockResolvedValue({
        data: { id: 'email-456' },
        error: null
      })

      await expect(
        sendForgotPasswordOtp('user@example.com', '654321')
      ).resolves.toBeUndefined()

      expect(mockEmailsSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: expect.stringContaining('654321')
        })
      )
    })
  })
})
