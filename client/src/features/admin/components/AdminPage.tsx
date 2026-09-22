import { useCallback, useEffect, useState } from 'react'
import { adminApi } from '@/features/admin/api/admin.api'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { Modal, Pagination } from '@/components/ui'
import type { AdminUser, AiUsageLog, CreditConfig } from '@/lib/types'

interface AdminPageProps {
  onBack?: () => void
}

export const AdminPage = ({ onBack }: AdminPageProps = {}) => {
  const currentUser = useAuthStore((state) => state.user)
  const isAdminOnly = currentUser?.role === 'admin'

  // Phân trang & dữ liệu người dùng
  const [users, setUsers] = useState<AdminUser[]>([])
  const [usersTotal, setUsersTotal] = useState(0)
  const [usersPage, setUsersPage] = useState(1)
  const [usersLimit, setUsersLimit] = useState(10)
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)

  // Phân trang & dữ liệu nhật ký AI
  const [logs, setLogs] = useState<AiUsageLog[]>([])
  const [logsTotal, setLogsTotal] = useState(0)
  const [logsPage, setLogsPage] = useState(1)
  const [logsLimit, setLogsLimit] = useState(10)
  const [isLoadingLogs, setIsLoadingLogs] = useState(false)

  // Cấu hình credit & trạng thái chung
  const [config, setConfig] = useState<CreditConfig | null>(null)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'users' | 'config' | 'logs'>(
    'users'
  )
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  // State cho Modal chỉnh sửa người dùng
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [editCredit, setEditCredit] = useState<string>('')
  const [editError, setEditError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // State cho Modal tạo tài khoản người dùng mới
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newCredit, setNewCredit] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  // State cho Modal khóa tài khoản người dùng
  const [lockingUser, setLockingUser] = useState<AdminUser | null>(null)
  const [isLocking, setIsLocking] = useState(false)
  const [lockError, setLockError] = useState<string | null>(null)

  // State cho Modal khôi phục tài khoản người dùng
  const [restoringUser, setRestoringUser] = useState<AdminUser | null>(null)
  const [isRestoring, setIsRestoring] = useState(false)
  const [restoreError, setRestoreError] = useState<string | null>(null)

  // State cho Modal xóa vĩnh viễn người dùng
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Tải danh sách người dùng
  const fetchUsers = useCallback(async () => {
    setIsLoadingUsers(true)
    try {
      const response = await adminApi.getUsers({
        search: search.trim() || undefined,
        page: usersPage,
        limit: usersLimit
      })
      setUsers(response.items)
      setUsersTotal(response.total)
    } catch (error) {
      console.error('Lỗi tải danh sách người dùng:', error)
    } finally {
      setIsLoadingUsers(false)
    }
  }, [search, usersPage, usersLimit])

  // Tải nhật ký AI
  const fetchLogs = useCallback(async () => {
    setIsLoadingLogs(true)
    try {
      const response = await adminApi.getAiUsage({
        page: logsPage,
        limit: logsLimit
      })
      setLogs(response.items)
      setLogsTotal(response.total)
    } catch (error) {
      console.error('Lỗi tải nhật ký AI:', error)
    } finally {
      setIsLoadingLogs(false)
    }
  }, [logsPage, logsLimit])

  // Tải cấu hình credit khi khởi tạo
  useEffect(() => {
    void adminApi
      .getCreditConfig()
      .then(setConfig)
      .catch((error) => console.error('Lỗi tải cấu hình credit:', error))
  }, [])

  // Tự động tải người dùng khi thay đổi từ khóa tìm kiếm hoặc trang
  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchUsers()
    }, 250)
    return () => clearTimeout(timer)
  }, [fetchUsers])

  // Tự động tải nhật ký AI khi đổi trang hoặc số lượng mỗi trang
  useEffect(() => {
    void fetchLogs()
  }, [fetchLogs])

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value)
    setUsersPage(1)
  }

  const saveConfig = async () => {
    if (config) {
      const updated = await adminApi.updateCreditConfig({
        pricePerSlide: config.pricePerSlide,
        pricePerAiEdit: config.pricePerAiEdit,
        signupBonus: config.signupBonus
      })
      setConfig(updated)
      setSaveMessage('Đã lưu cấu hình credit thành công')
      setTimeout(() => setSaveMessage(null), 3000)
    }
  }

  const openEditModal = (user: AdminUser) => {
    if (user._id === currentUser?.id || user.role === 'admin') return
    setEditingUser(user)
    setEditCredit(String(user.creditBalance))
    setEditError(null)
  }

  const handleSaveUser = async () => {
    if (!editingUser) return
    const parsedCredit = Number(editCredit)
    if (Number.isNaN(parsedCredit) || parsedCredit < 0) {
      setEditError('Số credit phải là một số nguyên dương hoặc bằng 0')
      return
    }

    try {
      setIsSubmitting(true)
      const updated = await adminApi.updateUser(editingUser._id, {
        creditBalance: parsedCredit
      })
      setUsers((prev) =>
        prev.map((u) =>
          u._id === editingUser._id
            ? {
                ...u,
                creditBalance: updated.creditBalance
              }
            : u
        )
      )
      setEditingUser(null)
      setSaveMessage(`Đã cập nhật số dư credit cho ${editingUser.name}`)
      setTimeout(() => setSaveMessage(null), 3000)
    } catch {
      setEditError('Không thể cập nhật người dùng, vui lòng thử lại')
    } finally {
      setIsSubmitting(false)
    }
  }

  const openCreateModal = () => {
    setIsCreateUserOpen(true)
    setNewName('')
    setNewEmail('')
    setNewPassword('')
    setNewCredit(String(config?.signupBonus ?? 100))
    setCreateError(null)
  }

  const handleCreateUser = async () => {
    if (!newName.trim()) {
      setCreateError('Vui lòng nhập họ và tên người dùng')
      return
    }
    if (
      !newEmail.trim() ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim())
    ) {
      setCreateError('Địa chỉ email không đúng định dạng')
      return
    }
    if (!newPassword || newPassword.length < 6) {
      setCreateError('Mật khẩu khởi tạo phải có tối thiểu 6 ký tự')
      return
    }
    const parsedCredit = Number(newCredit)
    if (Number.isNaN(parsedCredit) || parsedCredit < 0) {
      setCreateError('Số dư credit phải là số không âm')
      return
    }

    try {
      setIsCreating(true)
      const created = await adminApi.createUser({
        name: newName.trim(),
        email: newEmail.trim(),
        password: newPassword,
        creditBalance: parsedCredit
      })
      setUsers((prev) => [created, ...prev])
      setUsersTotal((prev) => prev + 1)
      setIsCreateUserOpen(false)
      setSaveMessage(`Đã tạo thành công tài khoản người dùng ${created.name}`)
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Không thể tạo tài khoản người dùng, vui lòng thử lại'
      setCreateError(errorMsg)
    } finally {
      setIsCreating(false)
    }
  }

  const getRemainingDays = (lockedAt?: string | null) => {
    if (!lockedAt) return 30
    const diffDays = Math.floor(
      (Date.now() - new Date(lockedAt).getTime()) / (24 * 60 * 60 * 1000)
    )
    return Math.max(1, 30 - diffDays)
  }

  const openLockModal = (user: AdminUser) => {
    if (user._id === currentUser?.id || user.role === 'admin') return
    setLockingUser(user)
    setLockError(null)
  }

  const handleConfirmLock = async () => {
    if (!lockingUser) return
    try {
      setIsLocking(true)
      const updated = await adminApi.lockUser(lockingUser._id)
      setUsers((prev) =>
        prev.map((u) => (u._id === lockingUser._id ? { ...u, ...updated } : u))
      )
      setSaveMessage(
        `Đã khóa tài khoản ${lockingUser.name}. Tài khoản sẽ tự động xóa sau 30 ngày nếu không được khôi phục.`
      )
      setLockingUser(null)
      setTimeout(() => setSaveMessage(null), 4000)
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Không thể khóa tài khoản, vui lòng thử lại'
      setLockError(errorMsg)
    } finally {
      setIsLocking(false)
    }
  }

  const openRestoreModal = (user: AdminUser) => {
    setRestoringUser(user)
    setRestoreError(null)
  }

  const handleConfirmRestore = async () => {
    if (!restoringUser) return
    try {
      setIsRestoring(true)
      const updated = await adminApi.restoreUser(restoringUser._id)
      setUsers((prev) =>
        prev.map((u) =>
          u._id === restoringUser._id ? { ...u, ...updated } : u
        )
      )
      setSaveMessage(
        `Đã khôi phục tài khoản ${restoringUser.name} về trạng thái hoạt động bình thường`
      )
      setRestoringUser(null)
      setTimeout(() => setSaveMessage(null), 4000)
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Không thể khôi phục tài khoản, vui lòng thử lại'
      setRestoreError(errorMsg)
    } finally {
      setIsRestoring(false)
    }
  }

  const openDeleteModal = (user: AdminUser) => {
    if (user._id === currentUser?.id || user.role === 'admin') return
    setDeletingUser(user)
    setDeleteError(null)
  }

  const handleConfirmDelete = async () => {
    if (!deletingUser) return
    try {
      setIsDeleting(true)
      await adminApi.deleteUser(deletingUser._id)
      setUsers((prev) => prev.filter((u) => u._id !== deletingUser._id))
      setUsersTotal((prev) => Math.max(0, prev - 1))
      setSaveMessage(
        `Đã xóa vĩnh viễn tài khoản ${deletingUser.name} cùng toàn bộ dữ liệu liên quan`
      )
      setDeletingUser(null)
      setTimeout(() => setSaveMessage(null), 4000)
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Không thể xóa người dùng, vui lòng thử lại'
      setDeleteError(errorMsg)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <main className='mx-auto max-w-7xl px-5 py-12 sm:px-12'>
      {!isAdminOnly && (
        <button
          className='mb-8 font-sans text-sm font-semibold text-orange-700 hover:underline'
          onClick={onBack}
        >
          ← Thư viện
        </button>
      )}
      <div className='mb-8'>
        <span className='font-sans text-xs font-bold tracking-widest text-orange-700'>
          ADMIN CONSOLE
        </span>
        <h1 className='mt-2 text-5xl font-medium leading-none text-emerald-950 sm:text-6xl'>
          Quản trị hệ thống
        </h1>
        <p className='mt-2 font-sans text-sm text-stone-600'>
          Khu vực dành riêng cho quản trị viên: quản lý người dùng, cấu hình
          credit và theo dõi nhật ký hoạt động AI.
        </p>
      </div>

      <div className='mb-6 flex gap-2 border-b border-stone-300 pb-2'>
        <button
          className={`px-4 py-2 font-sans text-sm font-semibold transition ${
            activeTab === 'users'
              ? 'border-b-2 border-orange-700 font-bold text-orange-700'
              : 'text-stone-600 hover:text-stone-900'
          }`}
          onClick={() => setActiveTab('users')}
        >
          Người dùng ({usersTotal})
        </button>
        <button
          className={`px-4 py-2 font-sans text-sm font-semibold transition ${
            activeTab === 'config'
              ? 'border-b-2 border-orange-700 font-bold text-orange-700'
              : 'text-stone-600 hover:text-stone-900'
          }`}
          onClick={() => setActiveTab('config')}
        >
          Cấu hình Credit
        </button>
        <button
          className={`px-4 py-2 font-sans text-sm font-semibold transition ${
            activeTab === 'logs'
              ? 'border-b-2 border-orange-700 font-bold text-orange-700'
              : 'text-stone-600 hover:text-stone-900'
          }`}
          onClick={() => setActiveTab('logs')}
        >
          Nhật ký AI ({logsTotal})
        </button>
      </div>

      {saveMessage && (
        <div className='mb-6 rounded bg-emerald-100 p-3 font-sans text-xs font-bold text-emerald-800'>
          ✅ {saveMessage}
        </div>
      )}

      {/* Tab 1: Quản lý người dùng */}
      {activeTab === 'users' && (
        <section className='border border-stone-300 bg-stone-50 p-7'>
          <div className='mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <h2 className='text-2xl font-medium text-emerald-950'>
                Danh sách người dùng
              </h2>
              <p className='font-sans text-xs text-stone-500'>
                Quản lý phân quyền, thêm mới, xóa và điều chỉnh số dư credit của
                từng thành viên
              </p>
            </div>
            <div className='flex items-center gap-2'>
              <input
                className='w-full border border-stone-300 bg-white p-2.5 font-sans text-sm outline-orange-700 sm:w-64'
                placeholder='Tìm theo tên hoặc email...'
                value={search}
                onChange={handleSearchChange}
              />
              <button
                type='button'
                onClick={openCreateModal}
                className='shrink-0 bg-emerald-950 px-3.5 py-2.5 font-sans text-xs font-bold text-white transition hover:bg-stone-900'
              >
                ➕ Thêm người dùng
              </button>
            </div>
          </div>

          <div className='mt-5 divide-y divide-stone-200'>
            {isLoadingUsers ? (
              <div className='py-8 text-center font-sans text-sm text-stone-500'>
                Đang tải dữ liệu người dùng...
              </div>
            ) : (
              <>
                {users
                  .filter(
                    (u) => u.role !== 'admin' && u._id !== currentUser?.id
                  )
                  .map((user) => (
                    <div
                      className='flex flex-col justify-between gap-3 py-4 font-sans text-sm sm:flex-row sm:items-center'
                      key={user._id}
                    >
                      <div>
                        <div className='flex items-center gap-2'>
                          <span className='font-bold text-stone-900'>
                            {user.name}
                          </span>
                          {user.status === 'locked' ? (
                            <span className='rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800'>
                              🔒 Đã khóa (còn {getRemainingDays(user.lockedAt)}{' '}
                              ngày)
                            </span>
                          ) : (
                            <span className='rounded bg-stone-200 px-2 py-0.5 text-xs font-semibold text-stone-700'>
                              Người dùng
                            </span>
                          )}
                        </div>
                        <small className='block text-stone-500'>
                          {user.email}
                        </small>
                      </div>
                      <div className='flex items-center gap-2'>
                        <span className='mr-1 font-semibold text-orange-700'>
                          {user.creditBalance} credit
                        </span>
                        <button
                          className='border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100 transition'
                          onClick={() => openEditModal(user)}
                          type='button'
                        >
                          Chỉnh sửa
                        </button>
                        {user.status === 'locked' ? (
                          <button
                            className='border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 hover:border-emerald-500 transition'
                            onClick={() => openRestoreModal(user)}
                            type='button'
                            title='Khôi phục tài khoản về trạng thái hoạt động bình thường'
                          >
                            Khôi phục
                          </button>
                        ) : (
                          <button
                            className='border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-50 hover:border-amber-500 transition'
                            onClick={() => openLockModal(user)}
                            type='button'
                            title='Khóa tài khoản và đếm ngược 30 ngày để xóa vĩnh viễn'
                          >
                            Khóa tài khoản
                          </button>
                        )}
                        <button
                          className='border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 hover:border-red-500 transition'
                          onClick={() => openDeleteModal(user)}
                          type='button'
                          title='Xóa vĩnh viễn người dùng'
                        >
                          Xóa
                        </button>
                      </div>
                    </div>
                  ))}
                {users.length === 0 && (
                  <div className='py-8 text-center font-sans text-sm text-stone-500'>
                    Không tìm thấy người dùng phù hợp
                  </div>
                )}
              </>
            )}
          </div>

          <Pagination
            page={usersPage}
            total={usersTotal}
            limit={usersLimit}
            onPageChange={setUsersPage}
            onLimitChange={(limit) => {
              setUsersLimit(limit)
              setUsersPage(1)
            }}
            itemName='người dùng'
          />
        </section>
      )}

      {/* Tab 2: Cấu hình Credit */}
      {activeTab === 'config' && (
        <section className='max-w-xl border border-stone-300 bg-stone-50 p-7'>
          <h2 className='mb-5 text-2xl font-medium text-emerald-950'>
            Cấu hình hệ thống Credit
          </h2>
          {config && (
            <div className='space-y-4'>
              <label className='block font-sans text-sm font-semibold text-stone-600'>
                Giá mỗi slide tạo mới (credit)
                <input
                  className='mt-2 w-full border border-stone-300 bg-white p-3 font-normal outline-orange-700'
                  type='number'
                  value={config.pricePerSlide}
                  onChange={(event) =>
                    setConfig({
                      ...config,
                      pricePerSlide: Number(event.target.value)
                    })
                  }
                />
              </label>
              <label className='block font-sans text-sm font-semibold text-stone-600'>
                Giá mỗi lượt AI chỉnh sửa slide (credit)
                <input
                  className='mt-2 w-full border border-stone-300 bg-white p-3 font-normal outline-orange-700'
                  type='number'
                  value={config.pricePerAiEdit}
                  onChange={(event) =>
                    setConfig({
                      ...config,
                      pricePerAiEdit: Number(event.target.value)
                    })
                  }
                />
              </label>
              <label className='block font-sans text-sm font-semibold text-stone-600'>
                Credit tặng khi người dùng đăng ký mới
                <input
                  className='mt-2 w-full border border-stone-300 bg-white p-3 font-normal outline-orange-700'
                  type='number'
                  value={config.signupBonus}
                  onChange={(event) =>
                    setConfig({
                      ...config,
                      signupBonus: Number(event.target.value)
                    })
                  }
                />
              </label>
              <button
                className='mt-5 bg-orange-700 px-5 py-3 font-sans text-sm font-bold text-white transition hover:bg-orange-800'
                onClick={() => void saveConfig()}
                type='button'
              >
                Lưu cấu hình
              </button>
            </div>
          )}
        </section>
      )}

      {/* Tab 3: Nhật ký AI */}
      {activeTab === 'logs' && (
        <section className='border border-stone-300 bg-stone-50 p-7'>
          <div className='mb-5 flex flex-col gap-1'>
            <h2 className='text-2xl font-medium text-emerald-950'>
              Nhật ký hoạt động AI
            </h2>
            <p className='font-sans text-xs text-stone-500'>
              Theo dõi lịch sử sinh bài giảng, nội dung prompt và lượng credit
              tiêu thụ
            </p>
          </div>

          <div className='overflow-x-auto'>
            <table className='w-full text-left font-sans text-sm'>
              <thead>
                <tr className='border-b border-stone-300 text-xs tracking-wider text-stone-500 uppercase'>
                  <th className='py-3'>Thời gian</th>
                  <th className='py-3'>Người dùng</th>
                  <th className='py-3'>Yêu cầu (Prompt)</th>
                  <th className='py-3'>Số slide</th>
                  <th className='py-3 text-right'>Credit tiêu thụ</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-stone-200'>
                {isLoadingLogs ? (
                  <tr>
                    <td
                      colSpan={5}
                      className='py-8 text-center text-xs text-stone-500'
                    >
                      Đang tải nhật ký...
                    </td>
                  </tr>
                ) : (
                  <>
                    {logs.map((log) => {
                      const userDisplay =
                        typeof log.userId === 'object' && log.userId !== null
                          ? log.userId.name ||
                            log.userId.email ||
                            log.userId._id.slice(-6)
                          : typeof log.userId === 'string'
                            ? log.userId.slice(-6)
                            : 'Ẩn danh'

                      const userEmail =
                        typeof log.userId === 'object' && log.userId !== null
                          ? log.userId.email
                          : undefined

                      return (
                        <tr key={log._id} className='hover:bg-stone-100/60'>
                          <td className='py-3 font-mono text-xs text-stone-500'>
                            {new Date(log.createdAt).toLocaleString('vi-VN')}
                          </td>
                          <td className='py-3 text-xs text-stone-800'>
                            <div className='font-semibold'>{userDisplay}</div>
                            {userEmail && (
                              <div className='font-mono text-[11px] text-stone-400'>
                                {userEmail}
                              </div>
                            )}
                          </td>
                          <td
                            className='max-w-xs truncate py-3 text-stone-800'
                            title={log.prompt}
                          >
                            {log.prompt || '(Trống)'}
                          </td>
                          <td className='py-3 text-stone-600'>
                            {log.slideCount}
                          </td>
                          <td className='py-3 text-right font-semibold text-orange-700'>
                            -{log.creditSpent}
                          </td>
                        </tr>
                      )
                    })}
                    {logs.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className='py-8 text-center text-stone-500'
                        >
                          Chưa có nhật ký hoạt động nào
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            page={logsPage}
            total={logsTotal}
            limit={logsLimit}
            onPageChange={setLogsPage}
            onLimitChange={(limit) => {
              setLogsLimit(limit)
              setLogsPage(1)
            }}
            itemName='nhật ký'
          />
        </section>
      )}

      {/* Modal Chỉnh sửa Credit người dùng */}
      <Modal
        open={Boolean(editingUser)}
        onClose={() => setEditingUser(null)}
        title='Chỉnh sửa credit người dùng'
      >
        {editingUser && (
          <div className='space-y-4 font-sans'>
            <div>
              <div className='text-xs font-semibold text-stone-500 uppercase'>
                Tên & Email
              </div>
              <div className='mt-1 text-sm font-bold text-stone-900'>
                {editingUser.name}
              </div>
              <div className='text-xs text-stone-500'>{editingUser.email}</div>
            </div>

            <div>
              <label
                htmlFor='user-credit'
                className='block text-xs font-semibold text-stone-600 uppercase'
              >
                Số dư Credit
              </label>
              <input
                id='user-credit'
                type='number'
                min='0'
                className='mt-1 w-full border border-stone-300 bg-white p-2.5 text-sm outline-orange-700'
                value={editCredit}
                onChange={(e) => setEditCredit(e.target.value)}
              />
            </div>

            {editError && (
              <div className='rounded bg-red-50 p-2 text-xs font-semibold text-red-700'>
                ❌ {editError}
              </div>
            )}

            <div className='mt-6 flex justify-end gap-2 pt-2'>
              <button
                type='button'
                className='border border-stone-300 px-4 py-2 text-xs font-semibold hover:bg-stone-100'
                onClick={() => setEditingUser(null)}
                disabled={isSubmitting}
              >
                Hủy
              </button>
              <button
                type='button'
                className='bg-orange-700 px-4 py-2 text-xs font-bold text-white hover:bg-orange-800 disabled:opacity-50'
                onClick={() => void handleSaveUser()}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Thêm người dùng mới */}
      <Modal
        open={isCreateUserOpen}
        onClose={() => setIsCreateUserOpen(false)}
        title='Thêm người dùng mới'
      >
        <div className='space-y-4 font-sans'>
          <div>
            <label
              htmlFor='new-user-name'
              className='block text-xs font-semibold text-stone-600 uppercase'
            >
              Họ và tên
            </label>
            <input
              id='new-user-name'
              type='text'
              placeholder='Ví dụ: Nguyễn Văn A'
              className='mt-1 w-full border border-stone-300 bg-white p-2.5 text-sm outline-orange-700'
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>

          <div>
            <label
              htmlFor='new-user-email'
              className='block text-xs font-semibold text-stone-600 uppercase'
            >
              Địa chỉ Email
            </label>
            <input
              id='new-user-email'
              type='email'
              placeholder='user@example.com'
              className='mt-1 w-full border border-stone-300 bg-white p-2.5 text-sm outline-orange-700'
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </div>

          <div>
            <label
              htmlFor='new-user-password'
              className='block text-xs font-semibold text-stone-600 uppercase'
            >
              Mật khẩu khởi tạo
            </label>
            <input
              id='new-user-password'
              type='password'
              placeholder='Tối thiểu 6 ký tự'
              className='mt-1 w-full border border-stone-300 bg-white p-2.5 text-sm outline-orange-700'
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>

          <div>
            <label
              htmlFor='new-user-credit'
              className='block text-xs font-semibold text-stone-600 uppercase'
            >
              Số dư Credit ban đầu
            </label>
            <input
              id='new-user-credit'
              type='number'
              min='0'
              className='mt-1 w-full border border-stone-300 bg-white p-2.5 text-sm outline-orange-700'
              value={newCredit}
              onChange={(e) => setNewCredit(e.target.value)}
            />
          </div>

          {createError && (
            <div className='rounded bg-red-50 p-2 text-xs font-semibold text-red-700'>
              ❌ {createError}
            </div>
          )}

          <div className='mt-6 flex justify-end gap-2 pt-2'>
            <button
              type='button'
              className='border border-stone-300 px-4 py-2 text-xs font-semibold hover:bg-stone-100'
              onClick={() => setIsCreateUserOpen(false)}
              disabled={isCreating}
            >
              Hủy
            </button>
            <button
              type='button'
              className='bg-emerald-950 px-4 py-2 text-xs font-bold text-white hover:bg-stone-900 disabled:opacity-50'
              onClick={() => void handleCreateUser()}
              disabled={isCreating}
            >
              {isCreating ? 'Đang tạo...' : 'Tạo người dùng'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Khóa tài khoản người dùng */}
      <Modal
        open={Boolean(lockingUser)}
        onClose={() => setLockingUser(null)}
        title='Khóa tài khoản người dùng'
      >
        {lockingUser && (
          <div className='space-y-4 font-sans'>
            <p className='text-sm text-stone-700 leading-relaxed'>
              Bạn có chắc chắn muốn khóa tài khoản người dùng{' '}
              <strong className='text-emerald-950'>{lockingUser.name}</strong> (
              <span className='font-mono text-stone-600'>
                {lockingUser.email}
              </span>
              )?
            </p>
            <div className='border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900 leading-relaxed space-y-1.5'>
              <div className='font-bold flex items-center gap-1.5 text-amber-950'>
                ⚠️ Quy trình khóa và xóa sau 30 ngày:
              </div>
              <ul className='list-disc list-inside space-y-1 text-amber-800'>
                <li>
                  Người dùng sẽ bị chặn đăng nhập ngay lập tức kèm thông báo
                  liên hệ Admin.
                </li>
                <li>
                  Hệ thống kích hoạt đếm ngược 30 ngày qua cronjob tự động.
                </li>
                <li>
                  Nếu không được khôi phục, tài khoản cùng toàn bộ bài giảng sẽ
                  bị xóa vĩnh viễn sau 30 ngày.
                </li>
                <li>
                  Admin có thể khôi phục lại tài khoản bất kỳ lúc nào trong vòng
                  30 ngày này.
                </li>
              </ul>
            </div>

            {lockError && (
              <div className='rounded bg-red-50 p-2 text-xs font-semibold text-red-700'>
                ❌ {lockError}
              </div>
            )}

            <div className='mt-6 flex justify-end gap-2 pt-2'>
              <button
                type='button'
                className='border border-stone-300 px-4 py-2 text-xs font-semibold hover:bg-stone-100'
                onClick={() => setLockingUser(null)}
                disabled={isLocking}
              >
                Hủy
              </button>
              <button
                type='button'
                className='bg-amber-700 px-4 py-2 text-xs font-bold text-white hover:bg-amber-800 disabled:opacity-50'
                onClick={() => void handleConfirmLock()}
                disabled={isLocking}
              >
                {isLocking ? 'Đang khóa...' : 'Xác nhận khóa'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Khôi phục tài khoản người dùng */}
      <Modal
        open={Boolean(restoringUser)}
        onClose={() => setRestoringUser(null)}
        title='Khôi phục tài khoản người dùng'
      >
        {restoringUser && (
          <div className='space-y-4 font-sans'>
            <p className='text-sm text-stone-700 leading-relaxed'>
              Khôi phục tài khoản người dùng{' '}
              <strong className='text-emerald-950'>{restoringUser.name}</strong>{' '}
              (
              <span className='font-mono text-stone-600'>
                {restoringUser.email}
              </span>
              ) về trạng thái hoạt động bình thường?
            </p>
            <div className='border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-800 leading-relaxed'>
              ✅ <strong>Hiệu lực:</strong> Lệnh đếm ngược 30 ngày sẽ bị hủy bỏ
              ngay lập tức và người dùng có thể đăng nhập, sử dụng studio trở
              lại bình thường.
            </div>

            {restoreError && (
              <div className='rounded bg-red-50 p-2 text-xs font-semibold text-red-700'>
                ❌ {restoreError}
              </div>
            )}

            <div className='mt-6 flex justify-end gap-2 pt-2'>
              <button
                type='button'
                className='border border-stone-300 px-4 py-2 text-xs font-semibold hover:bg-stone-100'
                onClick={() => setRestoringUser(null)}
                disabled={isRestoring}
              >
                Hủy
              </button>
              <button
                type='button'
                className='bg-emerald-800 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-900 disabled:opacity-50'
                onClick={() => void handleConfirmRestore()}
                disabled={isRestoring}
              >
                {isRestoring ? 'Đang xử lý...' : 'Khôi phục tài khoản'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Xóa vĩnh viễn người dùng */}
      <Modal
        open={Boolean(deletingUser)}
        onClose={() => setDeletingUser(null)}
        title='Xóa vĩnh viễn người dùng'
      >
        {deletingUser && (
          <div className='space-y-4 font-sans'>
            <p className='text-sm text-stone-700 leading-relaxed'>
              Bạn có chắc chắn muốn{' '}
              <strong className='text-red-700'>xóa vĩnh viễn</strong> tài khoản
              người dùng{' '}
              <strong className='text-emerald-950'>{deletingUser.name}</strong>{' '}
              (
              <span className='font-mono text-stone-600'>
                {deletingUser.email}
              </span>
              )?
            </p>
            <div className='border border-red-300 bg-red-50 p-3.5 text-xs text-red-900 leading-relaxed space-y-1.5'>
              <div className='font-bold flex items-center gap-1.5 text-red-950'>
                ⚠️ Cảnh báo hành động không thể hoàn tác:
              </div>
              <ul className='list-disc list-inside space-y-1 text-red-800'>
                <li>
                  Tài khoản người dùng sẽ bị xóa hoàn toàn khỏi hệ thống ngay
                  lập tức.
                </li>
                <li>
                  Toàn bộ bài giảng, slide trình chiếu và thư mục do người dùng
                  này tạo sẽ bị xóa vĩnh viễn.
                </li>
                <li>
                  Dữ liệu đã xóa không thể khôi phục lại dưới bất kỳ hình thức
                  nào.
                </li>
              </ul>
            </div>

            {deleteError && (
              <div className='rounded bg-red-50 p-2 text-xs font-semibold text-red-700'>
                ❌ {deleteError}
              </div>
            )}

            <div className='mt-6 flex justify-end gap-2 pt-2'>
              <button
                type='button'
                className='border border-stone-300 px-4 py-2 text-xs font-semibold hover:bg-stone-100'
                onClick={() => setDeletingUser(null)}
                disabled={isDeleting}
              >
                Hủy
              </button>
              <button
                type='button'
                className='bg-red-700 px-4 py-2 text-xs font-bold text-white hover:bg-red-800 disabled:opacity-50'
                onClick={() => void handleConfirmDelete()}
                disabled={isDeleting}
              >
                {isDeleting ? 'Đang xóa...' : 'Xác nhận xóa'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </main>
  )
}
