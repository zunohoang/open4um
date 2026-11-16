import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthPage } from '@/features/auth/components/AuthPage'
import { authApi } from '@/features/auth/api/auth.api'
import { LibraryPage } from '@/features/library/components/LibraryPage'
import { WorkspaceHeader } from '@/components/layout/WorkspaceHeader'
import { UserLayout } from '@/components/layout/UserLayout'
import { useAuthStore } from '@/features/auth/store/auth.store'

const AdminPage = lazy(() =>
  import('@/features/admin/components/AdminPage').then((m) => ({
    default: m.AdminPage
  }))
)
const EditorPage = lazy(() =>
  import('@/features/slide-editor/components/EditorPage').then((m) => ({
    default: m.EditorPage
  }))
)
const PresentationPage = lazy(() =>
  import('@/features/presentation/components/PresentationPage').then((m) => ({
    default: m.PresentationPage
  }))
)
const ProfilePage = lazy(() =>
  import('@/features/auth/components/ProfilePage').then((m) => ({
    default: m.ProfilePage
  }))
)
const ChangePasswordPage = lazy(() =>
  import('@/features/auth/components/ChangePasswordPage').then((m) => ({
    default: m.ChangePasswordPage
  }))
)

export const App = () => (
  <Suspense fallback={null}>
    <AppRoutes />
  </Suspense>
)

const AppRoutes = () => {
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

  // Admin chỉ cần quản trị hệ thống, không cần các tab khác -> UI content container không có sidebar
  if (isAdmin) {
    return (
      <div className='min-h-screen bg-brand-paper font-sans'>
        <WorkspaceHeader />
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
