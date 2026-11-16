import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { authApi } from '@/features/auth/api/auth.api'
import { useAuthStore } from '@/features/auth/store/auth.store'

// SRS UC003: đăng xuất phải qua popup xác nhận, xác nhận xong về trang chủ
export const useLogoutConfirm = () => {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const confirmLogout = () => {
    const { refreshToken, clearSession } = useAuthStore.getState()
    setOpen(false)
    if (refreshToken) void authApi.logout(refreshToken)
    navigate('/', { replace: true })
    clearSession()
  }

  const logoutDialog = (
    <ConfirmDialog
      open={open}
      title='Đăng xuất'
      message='Bạn có chắc chắn muốn đăng xuất khỏi hệ thống?'
      cancelLabel='Hủy bỏ'
      onConfirm={confirmLogout}
      onCancel={() => setOpen(false)}
    />
  )

  return { requestLogout: () => setOpen(true), logoutDialog }
}
