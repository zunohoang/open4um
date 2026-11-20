import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { authApi } from '@/features/auth/api/auth.api'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { useEditorStore } from '@/features/slide-editor/store/editor.store'
import { useToast } from '@/components/ui/Toast'

// SRS UC003: đăng xuất phải qua popup xác nhận, xác nhận xong về trang chủ
export const useLogoutConfirm = () => {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const beforeLeave = useEditorStore((state) => state.beforeLeave)
  const { showToast } = useToast()

  const confirmLogout = async (keepDraftOnly = false) => {
    if (pending) return
    setPending(true)
    const { refreshToken, clearSession } = useAuthStore.getState()
    try {
      if (beforeLeave && !(await beforeLeave(keepDraftOnly))) return
      if (refreshToken) await authApi.logout(refreshToken)
      setOpen(false)
      clearSession()
      navigate('/', { replace: true })
    } catch {
      showToast(
        'Không thể đăng xuất. Vui lòng kiểm tra kết nối và thử lại.',
        'error'
      )
    } finally {
      setPending(false)
    }
  }

  const logoutDialog = (
    <ConfirmDialog
      open={open}
      title='Đăng xuất'
      message={
        beforeLeave
          ? 'Bài giảng có thay đổi chưa lưu. Bạn có thể lưu lên máy chủ hoặc giữ bản nháp trong trình duyệt trước khi đăng xuất.'
          : 'Bạn có chắc chắn muốn đăng xuất khỏi hệ thống?'
      }
      cancelLabel='Hủy bỏ'
      pending={pending}
      onConfirm={() => confirmLogout()}
      secondaryLabel={beforeLeave ? 'Giữ nháp và đăng xuất' : undefined}
      onSecondary={beforeLeave ? () => confirmLogout(true) : undefined}
      onCancel={() => setOpen(false)}
    />
  )

  return { requestLogout: () => setOpen(true), logoutDialog }
}
