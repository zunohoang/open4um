import { useCallback, useEffect, useState } from 'react'
import {
  adminApi,
  type CreateUserPayload,
  type UpdateUserPayload
} from '@/features/admin/api/admin.api'
import { AdminDashboard } from '@/features/admin/components/AdminDashboard'
import { AiUsageManagement } from '@/features/admin/components/AiUsageManagement'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { ConfirmDialog, Modal, Pagination, useToast } from '@/components/ui'
import type { AdminUser, CreditConfig } from '@/lib/types'

type CreditConfigField =
  | 'pricePerLecture'
  | 'pricePerOutline'
  | 'pricePerSlide'
  | 'pricePerAiEdit'
  | 'signupBonus'
type CreditConfigForm = Record<CreditConfigField, string>
type CreditConfigErrors = Partial<Record<CreditConfigField, string>>

const CREDIT_FIELD_LABELS: Record<CreditConfigField, string> = {
  pricePerLecture: 'Credit sinh bài giảng',
  pricePerOutline: 'Credit sinh dàn ý',
  pricePerSlide: 'Credit tạo slide',
  pricePerAiEdit: 'Credit chỉnh sửa AI',
  signupBonus: 'Credit tặng khi đăng ký'
}

const EMPTY_CREDIT_FORM: CreditConfigForm = {
  pricePerLecture: '',
  pricePerOutline: '',
  pricePerSlide: '',
  pricePerAiEdit: '',
  signupBonus: ''
}

const toCreditConfigForm = (config: CreditConfig): CreditConfigForm => ({
  pricePerLecture: String(config.pricePerLecture),
  pricePerOutline: String(config.pricePerOutline),
  pricePerSlide: String(config.pricePerSlide),
  pricePerAiEdit: String(config.pricePerAiEdit),
  signupBonus: String(config.signupBonus)
})

const getRequestErrorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data
    ?.message || fallback

// Lỗi đầu tiên của form thêm/sửa người dùng, null nếu hợp lệ; credit undefined = bỏ qua kiểm tra credit
const getUserFormError = (name: string, email: string, credit?: string) => {
  if (!name.trim()) return 'Vui lòng nhập họ và tên người dùng'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return 'Địa chỉ email không đúng định dạng'
  }
  // Ô trống không được âm thầm thành 0 credit
  if (
    credit !== undefined &&
    (!/^\d+$/.test(credit.trim()) || !Number.isSafeInteger(Number(credit)))
  ) {
    return 'Số dư credit phải là số nguyên không âm'
  }
  return null
}

interface AdminPageProps {
  onBack?: () => void
}

export const AdminPage = ({ onBack }: AdminPageProps = {}) => {
  const currentUser = useAuthStore((state) => state.user)
  const isAdminOnly = currentUser?.role === 'admin'
  const { showToast } = useToast()

  // Phân trang & dữ liệu người dùng
  const [users, setUsers] = useState<AdminUser[]>([])
  const [usersTotal, setUsersTotal] = useState(0)
  const [usersPage, setUsersPage] = useState(1)
  const [usersLimit, setUsersLimit] = useState(10)
  const [isLoadingUsers, setIsLoadingUsers] = useState(true)
  const [usersError, setUsersError] = useState<string | null>(null)
  const [usersReloadKey, setUsersReloadKey] = useState(0)

  // Cấu hình credit & trạng thái chung
  const [config, setConfig] = useState<CreditConfig | null>(null)
  const [creditForm, setCreditForm] =
    useState<CreditConfigForm>(EMPTY_CREDIT_FORM)
  const [creditErrors, setCreditErrors] = useState<CreditConfigErrors>({})
  const [configError, setConfigError] = useState<string | null>(null)
  const [isLoadingConfig, setIsLoadingConfig] = useState(true)
  const [isSavingConfig, setIsSavingConfig] = useState(false)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'users' | 'config' | 'logs'
  >('dashboard')

  // State cho Modal chỉnh sửa người dùng
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editCredit, setEditCredit] = useState<string>('')
  const [editError, setEditError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Thay đổi đã kiểm tra, chờ Admin xác nhận
  const [pendingUpdate, setPendingUpdate] = useState<UpdateUserPayload | null>(
    null
  )

  // State cho Modal tạo tài khoản người dùng mới
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newCredit, setNewCredit] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  // Dữ liệu tạo mới đã kiểm tra, chờ Admin xác nhận
  const [pendingCreate, setPendingCreate] = useState<CreateUserPayload | null>(
    null
  )

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

  // Tải danh sách người dùng (debounce 250ms); bỏ kết quả cũ khi tham số đổi hoặc vừa tải lại
  useEffect(() => {
    let cancelled = false

    const fetchUsers = async () => {
      setIsLoadingUsers(true)
      setUsersError(null)
      try {
        const response = await adminApi.getUsers({
          search: search.trim() || undefined,
          page: usersPage,
          limit: usersLimit
        })
        if (cancelled) return

        const lastPage = Math.max(1, Math.ceil(response.total / usersLimit))
        // Trang hiện tại đã hết dữ liệu (vd: vừa xóa người cuối trang): lùi về trang cuối, effect sẽ tải lại
        if (usersPage > lastPage) {
          setUsersPage(lastPage)
          return
        }
        setUsers(response.items)
        setUsersTotal(response.total)
      } catch (error) {
        if (cancelled) return

        setUsers([])
        setUsersTotal(0)
        setUsersError(
          getRequestErrorMessage(
            error,
            'Không thể tải danh sách người dùng, vui lòng thử lại'
          )
        )
      }
      setIsLoadingUsers(false)
    }

    const timer = setTimeout(() => void fetchUsers(), 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [search, usersPage, usersLimit, usersReloadKey])

  // Tải lại ngay sau thao tác; hiện trạng thái tải để không còn thấy dữ liệu cũ
  const reloadUsers = () => {
    setIsLoadingUsers(true)
    setUsersReloadKey((key) => key + 1)
  }

  // Tải credit configs
  const fetchCreditConfig = useCallback(async () => {
    setIsLoadingConfig(true)
    setConfigError(null)
    try {
      const currentConfig = await adminApi.getCreditConfig()
      setConfig(currentConfig)
      setCreditForm(toCreditConfigForm(currentConfig))
      setCreditErrors({})
    } catch (error) {
      setConfigError(
        getRequestErrorMessage(
          error,
          'Không thể tải cấu hình credit. Vui lòng thử lại.'
        )
      )
    } finally {
      setIsLoadingConfig(false)
    }
  }, [])

  // Tải cấu hình credit khi khởi tạo
  useEffect(() => {
    void fetchCreditConfig()
  }, [fetchCreditConfig])

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value)
    setUsersPage(1)
  }

  const handleCreditFieldChange = (field: CreditConfigField, value: string) => {
    setCreditForm((previous) => ({ ...previous, [field]: value }))
    setCreditErrors((previous) => {
      if (!previous[field]) return previous
      const nextErrors = { ...previous }
      delete nextErrors[field]
      return nextErrors
    })
    setConfigError(null)
  }

  const parseCreditConfigForm = () => {
    const fields = Object.keys(creditForm) as CreditConfigField[]
    const errors: CreditConfigErrors = {}
    const values = {} as Record<CreditConfigField, number>

    fields.forEach((field) => {
      const rawValue = creditForm[field].trim()
      const parsedValue = Number(rawValue)
      if (!/^[1-9]\d*$/.test(rawValue) || !Number.isSafeInteger(parsedValue)) {
        errors[field] =
          `${CREDIT_FIELD_LABELS[field]} chỉ chấp nhận số nguyên dương`
        return
      }
      values[field] = parsedValue
    })

    return { errors, values }
  }

  const saveConfig = async () => {
    if (!config || isSavingConfig) return

    const { errors, values } = parseCreditConfigForm()
    if (Object.keys(errors).length > 0) {
      setCreditErrors(errors)
      setConfigError('Vui lòng kiểm tra lại các giá trị chưa hợp lệ.')
      return
    }

    try {
      setIsSavingConfig(true)
      setConfigError(null)
      const updated = await adminApi.updateCreditConfig({
        pricePerLecture: values.pricePerLecture,
        pricePerOutline: values.pricePerOutline,
        pricePerSlide: values.pricePerSlide,
        pricePerAiEdit: values.pricePerAiEdit,
        signupBonus: values.signupBonus
      })
      setConfig(updated)
      setCreditForm(toCreditConfigForm(updated))
      setCreditErrors({})
      showToast('Đã lưu cấu hình credit thành công', 'success')
    } catch (error) {
      setConfigError(
        getRequestErrorMessage(
          error,
          'Không thể lưu cấu hình credit. Vui lòng thử lại.'
        )
      )
    } finally {
      setIsSavingConfig(false)
    }
  }

  const openEditModal = (user: AdminUser) => {
    if (user._id === currentUser?.id || user.role === 'admin') return
    setEditingUser(user)
    setEditName(user.name)
    setEditEmail(user.email)
    setEditCredit(String(user.creditBalance))
    setEditError(null)
    setPendingUpdate(null)
  }

  // Kiểm tra form rồi chờ Admin xác nhận, chưa gọi API
  const handleSaveUser = () => {
    if (!editingUser) return
    // Số dư không đổi thì không kiểm tra lại (dữ liệu cũ có thể là số lẻ)
    const creditChanged =
      editCredit.trim() !== String(editingUser.creditBalance)
    const formError = getUserFormError(
      editName,
      editEmail,
      creditChanged ? editCredit : undefined
    )
    if (formError) {
      setEditError(formError)
      return
    }

    // Chỉ gửi trường đã đổi để không ghi đè credit bằng giá trị cũ trên màn hình
    const changes: UpdateUserPayload = {}
    const name = editName.trim()
    const email = editEmail.trim().toLowerCase()
    const creditBalance = Number(editCredit)
    if (name !== editingUser.name) changes.name = name
    if (email !== editingUser.email) changes.email = email
    if (creditChanged && creditBalance !== editingUser.creditBalance) {
      changes.creditBalance = creditBalance
    }
    if (Object.keys(changes).length === 0) {
      setEditError('Không có thay đổi nào để lưu')
      return
    }
    setEditError(null)
    setPendingUpdate(changes)
  }

  const confirmSaveUser = async () => {
    if (!editingUser || !pendingUpdate) return
    const changes = pendingUpdate
    // Đóng hộp xác nhận trước khi gọi API để bấm đúp không gửi 2 lần
    setPendingUpdate(null)
    try {
      setIsSubmitting(true)
      const updated = await adminApi.updateUser(editingUser._id, changes)
      setEditingUser(null)
      showToast(`Đã cập nhật thông tin người dùng ${updated.name}`, 'success')
    } catch (error) {
      setEditError(
        getRequestErrorMessage(
          error,
          'Không thể cập nhật người dùng, vui lòng thử lại'
        )
      )
    } finally {
      setIsSubmitting(false)
      // Tải lại cả khi lỗi (vd: 404 vì người dùng đã bị xóa ở phiên khác)
      reloadUsers()
    }
  }

  const openCreateModal = () => {
    setIsCreateUserOpen(true)
    setNewName('')
    setNewEmail('')
    setNewPassword('')
    setNewCredit(String(config?.signupBonus ?? 100))
    setCreateError(null)
    setPendingCreate(null)
  }

  // Kiểm tra form rồi chờ Admin xác nhận, chưa gọi API
  const handleCreateUser = () => {
    const formError =
      getUserFormError(newName, newEmail, newCredit) ??
      (newPassword.length < 6
        ? 'Mật khẩu khởi tạo phải có tối thiểu 6 ký tự'
        : null)
    if (formError) {
      setCreateError(formError)
      return
    }
    setCreateError(null)
    setPendingCreate({
      name: newName.trim(),
      email: newEmail.trim().toLowerCase(),
      password: newPassword,
      creditBalance: Number(newCredit)
    })
  }

  const confirmCreateUser = async () => {
    if (!pendingCreate) return
    const payload = pendingCreate
    // Đóng hộp xác nhận trước khi gọi API để bấm đúp không gửi 2 lần
    setPendingCreate(null)
    try {
      setIsCreating(true)
      const created = await adminApi.createUser(payload)
      setIsCreateUserOpen(false)
      showToast(
        `Đã tạo thành công tài khoản người dùng ${created.name}`,
        'success'
      )
      // Danh sách xếp mới nhất trước: về trang 1 để thấy người dùng vừa tạo
      setUsersPage(1)
      reloadUsers()
    } catch (err: unknown) {
      setCreateError(
        getRequestErrorMessage(
          err,
          'Không thể tạo tài khoản người dùng, vui lòng thử lại'
        )
      )
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
      showToast(
        `Đã khóa tài khoản ${lockingUser.name}. Tài khoản sẽ tự động xóa sau 30 ngày nếu không được khôi phục.`,
        'success'
      )
      setLockingUser(null)
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
      showToast(
        `Đã khôi phục tài khoản ${restoringUser.name} về trạng thái hoạt động bình thường`,
        'success'
      )
      setRestoringUser(null)
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
      showToast(
        `Đã xóa vĩnh viễn tài khoản ${deletingUser.name} cùng toàn bộ dữ liệu liên quan`,
        'success'
      )
      setDeletingUser(null)
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || 'Không thể xóa người dùng, vui lòng thử lại'
      setDeleteError(errorMsg)
    } finally {
      setIsDeleting(false)
      // Tải lại cả khi lỗi (vd: 404 vì người dùng đã bị xóa ở phiên khác)
      reloadUsers()
    }
  }

  // Tóm tắt các trường sẽ đổi, hiện trong hộp xác nhận cập nhật
  const updateSummary = [
    pendingUpdate?.name !== undefined && `Họ tên mới: ${pendingUpdate.name}.`,
    pendingUpdate?.email !== undefined &&
      `Email mới: ${pendingUpdate.email} (người dùng sẽ phải đăng nhập bằng email này).`,
    pendingUpdate?.creditBalance !== undefined &&
      `Số dư credit: ${editingUser?.creditBalance} → ${pendingUpdate.creditBalance}.`
  ]
    .filter(Boolean)
    .join(' ')

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
          Khu vực dành riêng cho quản trị viên: thống kê tổng quan, quản lý
          người dùng, cấu hình credit và theo dõi nhật ký hoạt động AI.
        </p>
      </div>

      <div className='mb-6 flex flex-wrap gap-2 border-b border-stone-300 pb-2'>
        <button
          className={`px-4 py-2 font-sans text-sm font-semibold transition ${
            activeTab === 'dashboard'
              ? 'border-b-2 border-orange-700 font-bold text-orange-700'
              : 'text-stone-600 hover:text-stone-900'
          }`}
          onClick={() => setActiveTab('dashboard')}
        >
          Tổng quan
        </button>
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
          AI Usage
        </button>
      </div>

      {/* Tab Tổng quan (Dashboard) */}
      {activeTab === 'dashboard' && <AdminDashboard />}

      {/* Tab 1: Quản lý người dùng */}
      {activeTab === 'users' && (
        <section className='border border-stone-300 bg-stone-50 p-7'>
          <div className='mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <h2 className='text-2xl font-medium text-emerald-950'>
                Danh sách người dùng
              </h2>
              <p className='font-sans text-xs text-stone-500'>
                Tìm kiếm, thêm mới, chỉnh sửa thông tin, khóa và xóa tài khoản
                người dùng
              </p>
            </div>
            <div className='flex items-center gap-2'>
              <input
                aria-label='Tìm kiếm người dùng theo tên hoặc email'
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
            ) : usersError ? (
              <div
                className='flex flex-col gap-3 border border-red-200 bg-red-50 p-4 font-sans text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between'
                role='alert'
              >
                <span>{usersError}</span>
                <button
                  className='self-start font-semibold underline underline-offset-2 sm:self-auto'
                  onClick={reloadUsers}
                  type='button'
                >
                  Thử lại
                </button>
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
          {isLoadingConfig ? (
            <div className='py-8 text-center font-sans text-sm text-stone-500'>
              Đang tải cấu hình credit...
            </div>
          ) : !config ? (
            <div className='rounded bg-red-50 p-3 font-sans'>
              <p className='text-xs font-semibold text-red-700'>
                {configError || 'Không thể tải cấu hình credit.'}
              </p>
              <button
                className='mt-3 border border-stone-300 bg-white px-3 py-2 text-xs font-semibold hover:bg-stone-100'
                onClick={() => void fetchCreditConfig()}
                type='button'
              >
                Tải lại
              </button>
            </div>
          ) : (
            <div className='space-y-4'>
              <label className='block font-sans text-sm font-semibold text-stone-600'>
                Giá mỗi lượt sinh bài giảng
                <input
                  aria-invalid={Boolean(creditErrors.pricePerLecture)}
                  className={`mt-2 w-full border bg-white p-3 font-normal outline-orange-700 ${
                    creditErrors.pricePerLecture
                      ? 'border-red-500'
                      : 'border-stone-300'
                  }`}
                  inputMode='numeric'
                  pattern='[0-9]*'
                  type='text'
                  value={creditForm.pricePerLecture}
                  onChange={(event) =>
                    handleCreditFieldChange(
                      'pricePerLecture',
                      event.target.value
                    )
                  }
                />
                {creditErrors.pricePerLecture && (
                  <span className='mt-1 block text-xs font-semibold text-red-700'>
                    {creditErrors.pricePerLecture}
                  </span>
                )}
              </label>

              <label className='block font-sans text-sm font-semibold text-stone-600'>
                Giá mỗi slide tạo mới trong AI Chat
                <input
                  aria-invalid={Boolean(creditErrors.pricePerSlide)}
                  className={`mt-2 w-full border bg-white p-3 font-normal outline-orange-700 ${
                    creditErrors.pricePerSlide
                      ? 'border-red-500'
                      : 'border-stone-300'
                  }`}
                  inputMode='numeric'
                  pattern='[0-9]*'
                  type='text'
                  value={creditForm.pricePerSlide}
                  onChange={(event) =>
                    handleCreditFieldChange('pricePerSlide', event.target.value)
                  }
                />
                {creditErrors.pricePerSlide && (
                  <span className='mt-1 block text-xs font-semibold text-red-700'>
                    {creditErrors.pricePerSlide}
                  </span>
                )}
              </label>

              <label className='block font-sans text-sm font-semibold text-stone-600'>
                Giá mỗi lượt AI chỉnh sửa slide
                <input
                  aria-invalid={Boolean(creditErrors.pricePerAiEdit)}
                  className={`mt-2 w-full border bg-white p-3 font-normal outline-orange-700 ${
                    creditErrors.pricePerAiEdit
                      ? 'border-red-500'
                      : 'border-stone-300'
                  }`}
                  inputMode='numeric'
                  pattern='[0-9]*'
                  type='text'
                  value={creditForm.pricePerAiEdit}
                  onChange={(event) =>
                    handleCreditFieldChange(
                      'pricePerAiEdit',
                      event.target.value
                    )
                  }
                />
                {creditErrors.pricePerAiEdit && (
                  <span className='mt-1 block text-xs font-semibold text-red-700'>
                    {creditErrors.pricePerAiEdit}
                  </span>
                )}
              </label>

              <label className='block font-sans text-sm font-semibold text-stone-600'>
                Giá mỗi lượt AI sinh dàn ý
                <input
                  aria-invalid={Boolean(creditErrors.pricePerOutline)}
                  className={`mt-2 w-full border bg-white p-3 font-normal outline-orange-700 ${
                    creditErrors.pricePerOutline
                      ? 'border-red-500'
                      : 'border-stone-300'
                  }`}
                  inputMode='numeric'
                  pattern='[0-9]*'
                  type='text'
                  value={creditForm.pricePerOutline}
                  onChange={(event) =>
                    handleCreditFieldChange(
                      'pricePerOutline',
                      event.target.value
                    )
                  }
                />
                {creditErrors.pricePerOutline && (
                  <span className='mt-1 block text-xs font-semibold text-red-700'>
                    {creditErrors.pricePerOutline}
                  </span>
                )}
              </label>

              <label className='block font-sans text-sm font-semibold text-stone-600'>
                Credit tặng khi người dùng đăng ký mới
                <input
                  aria-invalid={Boolean(creditErrors.signupBonus)}
                  className={`mt-2 w-full border bg-white p-3 font-normal outline-orange-700 ${
                    creditErrors.signupBonus
                      ? 'border-red-500'
                      : 'border-stone-300'
                  }`}
                  inputMode='numeric'
                  pattern='[0-9]*'
                  type='text'
                  value={creditForm.signupBonus}
                  onChange={(event) =>
                    handleCreditFieldChange('signupBonus', event.target.value)
                  }
                />
                {creditErrors.signupBonus && (
                  <span className='mt-1 block text-xs font-semibold text-red-700'>
                    {creditErrors.signupBonus}
                  </span>
                )}
              </label>

              {configError && (
                <div className='rounded bg-red-50 p-2 font-sans text-xs font-semibold text-red-700'>
                  ❌ {configError}
                </div>
              )}

              <button
                className='mt-5 bg-orange-700 px-5 py-3 font-sans text-sm font-bold text-white transition hover:bg-orange-800 disabled:opacity-50'
                disabled={isSavingConfig}
                onClick={() => void saveConfig()}
                type='button'
              >
                {isSavingConfig ? 'Đang lưu...' : 'Lưu cấu hình'}
              </button>
            </div>
          )}
        </section>
      )}

      {/* Tab 3: Nhật ký AI */}
      {activeTab === 'logs' && <AiUsageManagement />}

      {/* Modal Chỉnh sửa thông tin người dùng */}
      <Modal
        open={Boolean(editingUser)}
        onClose={() => {
          if (!isSubmitting) setEditingUser(null)
        }}
        title='Chỉnh sửa thông tin người dùng'
      >
        {editingUser && (
          <div className='space-y-4 font-sans'>
            <div>
              <label
                htmlFor='edit-user-name'
                className='block text-xs font-semibold text-stone-600 uppercase'
              >
                Họ và tên
              </label>
              <input
                id='edit-user-name'
                type='text'
                className='mt-1 w-full border border-stone-300 bg-white p-2.5 text-sm outline-orange-700'
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>

            <div>
              <label
                htmlFor='edit-user-email'
                className='block text-xs font-semibold text-stone-600 uppercase'
              >
                Địa chỉ Email
              </label>
              <input
                id='edit-user-email'
                type='email'
                className='mt-1 w-full border border-stone-300 bg-white p-2.5 text-sm outline-orange-700'
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
              />
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
              <div
                className='rounded bg-red-50 p-2 text-xs font-semibold text-red-700'
                role='alert'
              >
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
                onClick={handleSaveUser}
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
        onClose={() => {
          if (!isCreating) setIsCreateUserOpen(false)
        }}
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
            <div
              className='rounded bg-red-50 p-2 text-xs font-semibold text-red-700'
              role='alert'
            >
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
              onClick={handleCreateUser}
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
        onClose={() => {
          if (!isDeleting) setDeletingUser(null)
        }}
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

      {/* Xác nhận thêm/sửa (SRS UC030 bước 6): đặt sau mọi Modal để nằm trên form (cùng z-50, phần tử sau ở trên). Hủy = đóng form, không gọi API (6a) */}
      <ConfirmDialog
        open={isCreateUserOpen && Boolean(pendingCreate)}
        title='Xác nhận thêm người dùng'
        message={`Bạn có chắc chắn muốn thêm người dùng "${pendingCreate?.name}" (${pendingCreate?.email}) với ${pendingCreate?.creditBalance} credit ban đầu?`}
        confirmLabel='Thêm người dùng'
        onConfirm={() => void confirmCreateUser()}
        onCancel={() => {
          setPendingCreate(null)
          setIsCreateUserOpen(false)
        }}
      />
      <ConfirmDialog
        open={Boolean(editingUser && pendingUpdate)}
        title='Xác nhận cập nhật người dùng'
        message={`Bạn có chắc chắn muốn lưu thay đổi thông tin của người dùng "${editingUser?.name}"? ${updateSummary}`}
        confirmLabel='Lưu thay đổi'
        onConfirm={() => void confirmSaveUser()}
        onCancel={() => {
          setPendingUpdate(null)
          setEditingUser(null)
        }}
      />
    </main>
  )
}
