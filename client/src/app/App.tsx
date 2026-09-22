import { useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { AdminPage } from '@/features/admin/components/AdminPage'
import { AuthPage } from '@/features/auth/components/AuthPage'
import { authApi } from '@/features/auth/api/auth.api'
import { EditorPage } from '@/features/slide-editor/components/EditorPage'
import { LibraryPage } from '@/features/library/components/LibraryPage'
import { PresentationPage } from '@/features/presentation/components/PresentationPage'
import { ProfilePage } from '@/features/auth/components/ProfilePage'
import { ChangePasswordPage } from '@/features/auth/components/ChangePasswordPage'
import { WorkspaceHeader } from '@/components/layout/WorkspaceHeader'
import { UserLayout } from '@/components/layout/UserLayout'
import { useAuthStore } from '@/features/auth/store/auth.store'

export const App = () => {
  const navigate = useNavigate()
  const { user, accessToken, refreshToken, setSession, clearSession } =
    useAuthStore()

  useEffect(() => {
    if (!accessToken || user) return
    void authApi
      .profile()
      .then((nextUser) =>
        setSession({
          user: nextUser,
          accessToken: useAuthStore.getState().accessToken ?? accessToken,
          refreshToken: refreshToken ?? ''
        })
      )
      .catch(clearSession)
  }, [accessToken, clearSession, refreshToken, setSession, user])

  if (!accessToken || !user) return <AuthPage />

  const isAdmin = user.role === 'admin'

  const logout = () => {
    if (refreshToken) void authApi.logout(refreshToken)
    clearSession()
  }

  // Admin chỉ cần quản trị hệ thống, không cần các tab khác -> UI content container không có sidebar
  if (isAdmin) {
    return (
      <div className='min-h-screen bg-brand-paper font-sans'>
        <WorkspaceHeader onAdmin={() => navigate('/admin')} onLogout={logout} />
        <main className='pt-16 min-h-screen'>
          <Routes>
            <Route path='/admin' element={<AdminPage />} />
            <Route path='/profile' element={<ProfilePage />} />
            <Route path='/change-password' element={<ChangePasswordPage />} />
            <Route path='*' element={<Navigate to='/admin' replace />} />
          </Routes>
        </main>
      </div>
    )
  }

  return (
    <Routes>
      {/* 1. Chế độ trình chiếu bài giảng toàn màn hình */}
      <Route path='/presentation/:id' element={<PresentationPage />} />

      {/* 2. Chế độ chỉnh sửa slide toàn màn hình */}
      <Route path='/editor/:id' element={<EditorPage />} />

      {/* 3. Layout Không gian làm việc người dùng (Header + Sidebar cố định + Nội dung + Modal tạo mới) */}
      <Route element={<UserLayout />}>
        <Route path='/' element={<Navigate to='/library' replace />} />
        <Route path='/library' element={<LibraryPage viewMode='library' />} />
        <Route path='/trash' element={<LibraryPage viewMode='trash' />} />
        <Route path='/profile' element={<ProfilePage />} />
        <Route path='/change-password' element={<ChangePasswordPage />} />
        <Route path='*' element={<Navigate to='/library' replace />} />
      </Route>
    </Routes>
  )
}
