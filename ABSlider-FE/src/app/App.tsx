import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, Outlet, useNavigate } from 'react-router-dom'
import { AdminPage } from '@/features/admin/components/AdminPage'
import { AuthPage } from '@/features/auth/components/AuthPage'
import { authApi } from '@/features/auth/api/auth.api'
import { CreateLectureModal } from '@/features/lecture-generation/components/CreateLectureModal'
import { EditorPage } from '@/features/slide-editor/components/EditorPage'
import { LibraryPage } from '@/features/library/components/LibraryPage'
import { PresentationPage } from '@/features/presentation/components/PresentationPage'
import { WorkspaceHeader } from '@/components/layout/WorkspaceHeader'
import { Sidebar } from '@/components/layout/Sidebar'
import { useAuthStore } from '@/features/auth/store/auth.store'

export const App = () => {
  const navigate = useNavigate()
  const { user, accessToken, refreshToken, setSession, clearSession } =
    useAuthStore()
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

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
      <Route
        element={
          <div className='min-h-screen bg-brand-paper font-sans'>
            {/* Header cố định trên cùng */}
            <WorkspaceHeader onLogout={logout} />

            {/* Sidenav điều hướng cố định bên trái (chỉ người dùng thường) */}
            <Sidebar onCreateClick={() => setIsCreateModalOpen(true)} />

            {/* Vùng nội dung chính bên phải */}
            <main className='ml-60 pt-16 min-h-screen'>
              <Outlet />
            </main>

            {/* Modal Tạo bài giảng */}
            <CreateLectureModal
              open={isCreateModalOpen}
              onClose={() => setIsCreateModalOpen(false)}
              onDone={(created) => {
                setIsCreateModalOpen(false)
                navigate(`/editor/${created._id}`, {
                  state: { lecture: created }
                })
              }}
            />
          </div>
        }
      >
        <Route path='/' element={<Navigate to='/library' replace />} />
        <Route path='/library' element={<LibraryPage viewMode='library' />} />
        <Route path='/trash' element={<LibraryPage viewMode='trash' />} />
        <Route path='*' element={<Navigate to='/library' replace />} />
      </Route>
    </Routes>
  )
}
