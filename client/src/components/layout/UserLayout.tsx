import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { WorkspaceHeader } from '@/components/layout/WorkspaceHeader'
import { Sidebar } from '@/components/layout/Sidebar'
import { CreateLectureModal } from '@/features/lecture-generation/components/CreateLectureModal'
import { authApi } from '@/features/auth/api/auth.api'
import { useAuthStore } from '@/features/auth/store/auth.store'

interface UserLayoutProps {
  totalLectures?: number
}

export const UserLayout = ({ totalLectures }: UserLayoutProps = {}) => {
  const navigate = useNavigate()
  const { refreshToken, clearSession } = useAuthStore()
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  const logout = () => {
    if (refreshToken) void authApi.logout(refreshToken)
    clearSession()
  }

  return (
    <div className='min-h-screen bg-brand-paper font-sans'>
      {/* Header cố định trên cùng */}
      <WorkspaceHeader onLogout={logout} />

      {/* Sidenav điều hướng cố định bên trái */}
      <Sidebar
        onCreateClick={() => setIsCreateModalOpen(true)}
        totalLectures={totalLectures}
      />

      {/* Vùng nội dung chính cuộn độc lập bên phải */}
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
  )
}
