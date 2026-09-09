import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { lectureApi } from '@/features/library/api/lecture.api'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ExportModal, useToast } from '@/components/ui'
import type { Folder, Lecture } from '@/lib/types'

interface LibraryPageProps {
  onOpen?: (lecture: Lecture) => void
  onPresent?: (lecture: Lecture) => void
  viewMode?: 'library' | 'trash'
}

interface ContextMenuState {
  x: number
  y: number
  lecture: Lecture
}

// Hàm tính số ngày đếm ngược còn lại (30 ngày kể từ deletedAt)
const getDaysRemaining = (deletedAt: string | null) => {
  if (!deletedAt) return 30
  const deleteTime = new Date(deletedAt).getTime()
  const expiryTime = deleteTime + 30 * 24 * 60 * 60 * 1000
  const now = Date.now()
  const diffMs = expiryTime - now
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  return Math.max(0, days)
}

export const LibraryPage = ({
  onOpen,
  onPresent,
  viewMode
}: LibraryPageProps) => {
  const { showToast } = useToast()
  const notifySuccess = useCallback(
    (msg: string) => showToast(msg, 'success'),
    [showToast]
  )
  const notifyError = useCallback(
    (msg: string) => showToast(msg, 'error'),
    [showToast]
  )
  const navigate = useNavigate()
  const location = useLocation()

  // Xác định viewMode từ prop hoặc URL pathname
  const activeViewMode: 'library' | 'trash' =
    viewMode || (location.pathname.startsWith('/trash') ? 'trash' : 'library')

  const handleOpen = (lecture: Lecture) => {
    if (onOpen) {
      onOpen(lecture)
    } else {
      navigate(`/editor/${lecture._id}`, { state: { lecture } })
    }
  }

  const handlePresent = (lecture: Lecture) => {
    if (onPresent) {
      onPresent(lecture)
    } else {
      navigate(`/presentation/${lecture._id}`, { state: { lecture } })
    }
  }

  const [lectures, setLectures] = useState<Lecture[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [search, setSearch] = useState('')
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'createdAt' | 'updatedAt' | 'title'>(
    'createdAt'
  )

  // State menu chuột phải
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)

  // State Modal tạo & đổi tên thư mục
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false)
  const [folderToEdit, setFolderToEdit] = useState<Folder | null>(null)
  const [folderNameInput, setFolderNameInput] = useState('')
  const [folderError, setFolderError] = useState<string | null>(null)
  const [isFolderSubmitting, setIsFolderSubmitting] = useState(false)

  // State đổi tên bài giảng
  const [renamingLecture, setRenamingLecture] = useState<Lecture | null>(null)
  const [renameTitleInput, setRenameTitleInput] = useState('')

  // State chuyển thư mục bài giảng
  const [movingLecture, setMovingLecture] = useState<Lecture | null>(null)
  const [targetFolderId, setTargetFolderId] = useState<string>('')

  // State xuất bản bài giảng (Modal lựa chọn ảnh hoặc PDF)
  const [lectureToExport, setLectureToExport] = useState<Lecture | null>(null)

  // State xóa bài giảng / thư mục
  const [lectureToDelete, setLectureToDelete] = useState<string | null>(null)
  const [folderToDelete, setFolderToDelete] = useState<Folder | null>(null)

  // Tải dữ liệu
  const load = useCallback(async () => {
    try {
      if (activeViewMode === 'trash') {
        const [trashRes, nextFolders] = await Promise.all([
          lectureApi.trash(),
          lectureApi.folders()
        ])
        const trashItems = Array.isArray(trashRes)
          ? trashRes
          : (trashRes as { items: Lecture[] }).items || []
        setLectures(trashItems)
        setFolders(nextFolders)
      } else {
        const [result, nextFolders] = await Promise.all([
          lectureApi.list({
            search: search.trim() || undefined,
            folderId: selectedFolderId || undefined,
            sortBy,
            sortOrder: sortBy === 'title' ? 'asc' : 'desc',
            limit: '100'
          }),
          lectureApi.folders()
        ])
        setLectures(result.items)
        setFolders(nextFolders)
      }
    } catch {
      notifyError('Không tải được dữ liệu từ máy chủ')
    }
  }, [search, selectedFolderId, sortBy, activeViewMode, notifyError])

  useEffect(() => {
    void load()
  }, [load])

  // Đóng menu chuột phải khi click ra ngoài hoặc nhấn phím ESC
  useEffect(() => {
    const handleGlobalClick = (event: MouseEvent) => {
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(event.target as Node)
      ) {
        setContextMenu(null)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null)
      }
    }

    if (contextMenu) {
      document.addEventListener('mousedown', handleGlobalClick)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleGlobalClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [contextMenu])

  // Bắt sự kiện chuột phải trên bài giảng
  const handleContextMenu = (e: React.MouseEvent, lecture: Lecture) => {
    e.preventDefault()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      lecture
    })
  }

  // Thao tác Thư mục
  const openCreateFolderModal = () => {
    setFolderToEdit(null)
    setFolderNameInput('')
    setFolderError(null)
    setIsFolderModalOpen(true)
  }

  const openEditFolderModal = (folder: Folder) => {
    setFolderToEdit(folder)
    setFolderNameInput(folder.name)
    setFolderError(null)
    setIsFolderModalOpen(true)
  }

  const handleSaveFolder = async () => {
    const trimmed = folderNameInput.trim()
    if (!trimmed) {
      setFolderError('Tên thư mục không được để trống')
      return
    }

    try {
      setIsFolderSubmitting(true)
      if (folderToEdit) {
        await lectureApi.updateFolder(folderToEdit._id, trimmed)
        notifySuccess('Đã cập nhật tên thư mục thành công')
      } else {
        await lectureApi.createFolder(trimmed)
        notifySuccess('Đã tạo thư mục mới thành công')
      }
      setIsFolderModalOpen(false)
      void load()
    } catch {
      setFolderError('Không thể lưu thư mục')
    } finally {
      setIsFolderSubmitting(false)
    }
  }

  const handleConfirmDeleteFolder = async () => {
    if (!folderToDelete) return
    try {
      await lectureApi.deleteFolder(folderToDelete._id)
      if (selectedFolderId === folderToDelete._id) {
        setSelectedFolderId('')
      }
      setFolderToDelete(null)
      notifySuccess(
        'Đã xóa thư mục. Các bài giảng bên trong chuyển về Chưa phân loại.'
      )
      void load()
    } catch {
      notifyError('Không thể xóa thư mục')
    }
  }

  // Thao tác Đổi tên bài giảng
  const handleRenameLecture = async () => {
    if (!renamingLecture) return
    const trimmed = renameTitleInput.trim()
    if (!trimmed) return

    try {
      await lectureApi.update(renamingLecture._id, { title: trimmed })
      setRenamingLecture(null)
      notifySuccess('Đã đổi tên bài giảng thành công')
      void load()
    } catch {
      notifyError('Không thể đổi tên bài giảng')
    }
  }

  // Thao tác Chuyển bài giảng vào thư mục
  const handleMoveLectureToFolder = async () => {
    if (!movingLecture) return
    try {
      await lectureApi.update(movingLecture._id, {
        folderId: targetFolderId || null
      })
      setMovingLecture(null)
      notifySuccess('Đã chuyển thư mục bài giảng thành công')
      void load()
    } catch {
      notifyError('Không thể chuyển bài giảng vào thư mục')
    }
  }

  // Thao tác Nhân bản bài giảng
  const handleDuplicateLecture = async (lectureId: string) => {
    try {
      await lectureApi.duplicate(lectureId)
      notifySuccess('Đã nhân bản bài giảng thành công')
      void load()
    } catch {
      notifyError('Không thể nhân bản bài giảng')
    }
  }
  // Thao tác Soft Delete: Chuyển bài giảng vào thùng rác (đếm ngược 30 ngày)
  const handleConfirmDeleteLecture = async () => {
    if (!lectureToDelete) return
    try {
      await lectureApi.moveToTrash(lectureToDelete)
      setLectureToDelete(null)
      notifySuccess(
        'Đã chuyển bài giảng vào thùng rác (đếm ngược 30 ngày tự động xóa)'
      )
      void load()
    } catch {
      notifyError('Không thể chuyển bài giảng vào thùng rác')
    }
  }

  // Thao tác Khôi phục bài giảng về trạng thái hoạt động bình thường
  const handleRestoreLecture = async (lectureId: string) => {
    try {
      await lectureApi.restore(lectureId)
      notifySuccess('Đã khôi phục bài giảng về Thư viện thành công')
      void load()
    } catch {
      notifyError('Không thể khôi phục bài giảng')
    }
  }

  // Hàm render card bài giảng
  const renderLectureCard = (lecture: Lecture) => (
    <article
      key={lecture._id}
      onContextMenu={(e) => handleContextMenu(e, lecture)}
      onClick={() => {
        if (activeViewMode === 'trash') {
          void handleRestoreLecture(lecture._id)
        } else {
          handleOpen(lecture)
        }
      }}
      className='group flex cursor-pointer flex-col justify-between border border-stone-300 bg-white p-6 transition hover:border-emerald-950 hover:shadow-xs'
    >
      {/* Khung thumbnail bài giảng tỷ lệ 4:3 kinh điển */}
      <div className='flex aspect-4/3 flex-col justify-between bg-stone-100 p-5'>
        {activeViewMode === 'trash' ? (
          <div className='flex items-center justify-between'>
            <span className='border border-red-300 bg-red-50 px-2 py-0.5 font-mono text-[11px] font-bold text-red-700'>
              ⏳ Còn {getDaysRemaining(lecture.deletedAt)} ngày
            </span>
            <span className='font-mono text-[10px] text-stone-400'>
              Đã xóa:{' '}
              {new Date(lecture.deletedAt || '').toLocaleDateString('vi-VN')}
            </span>
          </div>
        ) : (
          <div className='flex items-center justify-between'>
            <span className='font-sans text-[10px] font-bold tracking-widest text-stone-600 uppercase opacity-80'>
              {lecture.slides.length} SLIDES
            </span>
            <span className='font-mono text-[10px] text-stone-400'>
              {new Date(
                lecture.createdAt || lecture.updatedAt
              ).toLocaleDateString('vi-VN')}
            </span>
          </div>
        )}

        <strong className='max-w-[85%] text-2xl font-medium leading-none text-emerald-950 font-display line-clamp-3'>
          {lecture.slides[0]?.title || lecture.title || 'Bản nháp'}
        </strong>
      </div>

      {/* Tiêu đề bài giảng & Metadata bên dưới */}
      <div className='flex items-start justify-between gap-4 pt-4'>
        <div className='min-w-0 flex-1'>
          <h3 className='truncate text-xl font-medium text-emerald-950 font-display'>
            {lecture.title}
          </h3>
          <div className='mt-1 flex items-center gap-2 font-sans text-xs text-stone-500'>
            {activeViewMode === 'trash' ? (
              <span className='text-stone-500'>
                Tự động xóa vĩnh viễn sau {getDaysRemaining(lecture.deletedAt)}{' '}
                ngày
              </span>
            ) : (
              <span>
                {new Date(
                  lecture.createdAt || lecture.updatedAt
                ).toLocaleDateString('vi-VN')}
              </span>
            )}
          </div>
        </div>

        {/* Nút hành động */}
        {activeViewMode === 'trash' ? (
          <button
            type='button'
            onClick={(e) => {
              e.stopPropagation()
              void handleRestoreLecture(lecture._id)
            }}
            className='shrink-0 border border-emerald-700 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100'
            title='Khôi phục bài giảng về Thư viện'
          >
            ♻️ Khôi phục
          </button>
        ) : (
          <button
            type='button'
            onClick={(e) => {
              e.stopPropagation()
              handleContextMenu(e, lecture)
            }}
            className='p-1 text-stone-400 hover:text-emerald-950 transition'
            title='Tùy chọn bài giảng'
          >
            ⋮
          </button>
        )}
      </div>
    </article>
  )

  return (
    <div className='px-6 py-10 sm:px-12'>
      {/* Tiêu đề trang phong cách xuất bản cổ điển */}
      <div className='mb-9'>
        <span className='font-sans text-xs font-bold tracking-widest text-orange-700 uppercase'>
          {activeViewMode === 'trash'
            ? 'RECYCLE BIN • 30-DAY RETENTION'
            : 'YOUR LIBRARY'}
        </span>
        <h1 className='mt-2 text-6xl font-medium leading-none tracking-tighter text-emerald-950 font-display'>
          {activeViewMode === 'trash' ? 'Thùng rác bài giảng' : 'Bài giảng'}
        </h1>
        <p className='mt-3 font-sans text-sm text-stone-500'>
          {activeViewMode === 'trash'
            ? 'Các bài giảng bị xóa sẽ được lưu giữ và đếm ngược 30 ngày trước khi hệ thống tự động xóa vĩnh viễn. Bạn có thể khôi phục lại bất cứ lúc nào.'
            : 'Một nơi cho những ý tưởng đáng được dạy.'}
        </p>
      </div>

      {/* DANH SÁCH THƯ MỤC THEO DẠNG DANH SÁCH HÌNH CHỮ NHẬT XẾP NGANG TRÊN CÙNG */}
      {activeViewMode !== 'trash' && (
        <div className='mb-7'>
          <div className='flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none'>
            {/* Thẻ Tất cả */}
            <button
              type='button'
              onClick={() => setSelectedFolderId('')}
              className={`flex shrink-0 items-center gap-2 border px-4 py-2 font-sans text-xs font-semibold transition ${
                selectedFolderId === '' || selectedFolderId === null
                  ? 'border-emerald-950 bg-stone-200/80 font-bold text-emerald-950'
                  : 'border-stone-300 bg-white text-stone-600 hover:border-stone-400 hover:text-emerald-950'
              }`}
            >
              <span>📂 Tất cả bài giảng</span>
              <span className='border border-stone-300 bg-stone-100 px-1.5 py-0.2 font-mono text-[10px]'>
                {lectures.length}
              </span>
            </button>

            {/* Thẻ Chưa phân loại */}
            <button
              type='button'
              onClick={() => setSelectedFolderId('unorganized')}
              className={`flex shrink-0 items-center gap-2 border px-4 py-2 font-sans text-xs font-semibold transition ${
                selectedFolderId === 'unorganized'
                  ? 'border-emerald-950 bg-stone-200/80 font-bold text-emerald-950'
                  : 'border-stone-300 bg-white text-stone-600 hover:border-stone-400 hover:text-emerald-950'
              }`}
            >
              <span>📄 Chưa phân loại</span>
              <span className='border border-stone-300 bg-stone-100 px-1.5 py-0.2 font-mono text-[10px]'>
                {lectures.filter((l) => !l.folderId).length}
              </span>
            </button>

            {/* Các thẻ thư mục người dùng tạo */}
            {folders.map((folder) => {
              const count = lectures.filter(
                (l) => l.folderId === folder._id
              ).length
              return (
                <button
                  key={folder._id}
                  type='button'
                  onClick={() => setSelectedFolderId(folder._id)}
                  className={`flex shrink-0 items-center gap-2 border px-4 py-2 font-sans text-xs font-semibold transition ${
                    selectedFolderId === folder._id
                      ? 'border-emerald-950 bg-stone-200/80 font-bold text-emerald-950'
                      : 'border-stone-300 bg-white text-stone-600 hover:border-stone-400 hover:text-emerald-950'
                  }`}
                >
                  <span>📁 {folder.name}</span>
                  <span className='border border-stone-300 bg-stone-100 px-1.5 py-0.2 font-mono text-[10px]'>
                    {count}
                  </span>
                  <span
                    onClick={(e) => {
                      e.stopPropagation()
                      openEditFolderModal(folder)
                    }}
                    className='ml-1 text-stone-400 hover:text-emerald-950'
                    title='Đổi tên / Xóa thư mục'
                  >
                    ✏️
                  </span>
                </button>
              )
            })}

            {/* Nút Tạo thư mục mới hình chữ nhật */}
            <button
              type='button'
              onClick={openCreateFolderModal}
              className='flex shrink-0 items-center gap-1.5 border border-dashed border-orange-700 bg-orange-50/40 px-3.5 py-2 font-sans text-xs font-bold text-orange-700 transition hover:bg-orange-100'
            >
              <span>+ Thư mục mới</span>
            </button>
          </div>
        </div>
      )}

      {/* THANH BỘ LỌC & TÌM KIẾM BÊN TRÊN LIST */}
      {activeViewMode !== 'trash' && (
        <div className='mb-7 grid gap-3 sm:grid-cols-[1fr_200px_160px]'>
          <div className='relative'>
            <input
              type='text'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder='Tìm kiếm bài giảng...'
              className='w-full border border-stone-300 bg-white p-3 font-sans text-xs outline-orange-700'
            />
          </div>

          <select
            aria-label='Lọc theo thư mục'
            value={selectedFolderId || ''}
            onChange={(e) => setSelectedFolderId(e.target.value || null)}
            className='border border-stone-300 bg-stone-50 p-3 font-sans text-xs text-stone-700 outline-orange-700'
          >
            <option value=''>Tất cả thư mục</option>
            {folders.map((folder) => (
              <option key={folder._id} value={folder._id}>
                {folder.name}
              </option>
            ))}
          </select>

          <select
            aria-label='Sắp xếp bài giảng'
            value={sortBy}
            onChange={(e) =>
              setSortBy(e.target.value as 'createdAt' | 'updatedAt' | 'title')
            }
            className='border border-stone-300 bg-stone-50 p-3 font-sans text-xs text-stone-700 outline-orange-700'
          >
            <option value='createdAt'>Mới tạo (Mặc định)</option>
            <option value='updatedAt'>Mới cập nhật</option>
            <option value='title'>Tên (A-Z)</option>
          </select>
        </div>
      )}

      {/* NỘI DUNG DANH SÁCH BÀI GIẢNG / THÙNG RÁC */}
      {activeViewMode === 'trash' ? (
        <div>
          {lectures.length > 0 ? (
            <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-3'>
              {lectures.map(renderLectureCard)}
            </div>
          ) : (
            <div className='border border-dashed border-stone-400 p-16 text-center'>
              <h3 className='text-3xl font-medium text-emerald-950 font-display'>
                Thùng rác trống
              </h3>
              <p className='my-3 font-sans text-sm text-stone-500'>
                Không có bài giảng nào trong thùng rác.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div>
          {/* TRƯỜNG HỢP 1: ĐANG LỌC THEO MỘT THƯ MỤC CỤ THỂ */}
          {selectedFolderId &&
            selectedFolderId !== 'unorganized' &&
            (() => {
              const currentFolder = folders.find(
                (f) => f._id === selectedFolderId
              )
              const folderLectures = lectures.filter(
                (l) => l.folderId === selectedFolderId
              )
              return (
                <section className='mb-12'>
                  <div className='flex items-baseline justify-between pb-2'>
                    <div className='flex items-center gap-3'>
                      <h2 className='text-2xl font-medium text-emerald-950 font-display flex items-center gap-2'>
                        <span>📁</span>
                        <span>{currentFolder?.name || 'Thư mục'}</span>
                      </h2>
                      <span className='border border-stone-300 bg-stone-100 px-2 py-0.5 font-mono text-xs font-semibold text-stone-600'>
                        {folderLectures.length} bài giảng
                      </span>
                    </div>
                    {currentFolder && (
                      <button
                        type='button'
                        onClick={() => openEditFolderModal(currentFolder)}
                        className='flex items-center gap-1.5 border border-stone-300 bg-white px-3 py-1.5 font-sans text-xs font-semibold text-stone-600 transition hover:border-stone-400 hover:text-emerald-950'
                      >
                        <span>✏️</span>
                        <span>Đổi tên / Xóa thư mục</span>
                      </button>
                    )}
                  </div>

                  {/* Đường kẻ ngang */}
                  <div className='h-[1.5px] w-full bg-stone-300 mb-6'></div>

                  {/* Danh sách bài giảng thuộc thư mục */}
                  {folderLectures.length > 0 ? (
                    <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-3'>
                      {folderLectures.map(renderLectureCard)}
                    </div>
                  ) : (
                    <div className='border border-dashed border-stone-300 bg-stone-50/50 p-10 text-center'>
                      <p className='text-xs text-stone-500'>
                        Thư mục này hiện chưa có bài giảng nào. Nhấn chuột phải
                        vào bất kỳ bài giảng nào và chọn{' '}
                        <strong>"Chuyển thư mục"</strong> để thêm vào đây.
                      </p>
                    </div>
                  )}
                </section>
              )
            })()}

          {/* TRƯỜNG HỢP 2: ĐANG CHỌN XEM "CHƯA PHÂN LOẠI" */}
          {selectedFolderId === 'unorganized' &&
            (() => {
              const unorganizedLectures = lectures.filter((l) => !l.folderId)
              return (
                <section className='mb-12'>
                  <div className='flex items-baseline justify-between pb-2'>
                    <div className='flex items-center gap-3'>
                      <h2 className='text-2xl font-medium text-emerald-950 font-display flex items-center gap-2'>
                        <span>📄</span>
                        <span>Bài giảng chưa phân loại</span>
                      </h2>
                      <span className='border border-stone-300 bg-stone-100 px-2 py-0.5 font-mono text-xs font-semibold text-stone-600'>
                        {unorganizedLectures.length} bài giảng
                      </span>
                    </div>
                  </div>

                  {/* Đường kẻ ngang */}
                  <div className='h-[1.5px] w-full bg-stone-300 mb-6'></div>

                  {/* Danh sách bài giảng */}
                  {unorganizedLectures.length > 0 ? (
                    <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-3'>
                      {unorganizedLectures.map(renderLectureCard)}
                    </div>
                  ) : (
                    <div className='border border-dashed border-stone-300 bg-stone-50/50 p-10 text-center'>
                      <p className='text-xs text-stone-500'>
                        Không có bài giảng nào chưa phân loại. Tất cả bài giảng
                        đã được xếp vào các thư mục.
                      </p>
                    </div>
                  )}
                </section>
              )
            })()}

          {/* TRƯỜNG HỢP 3: XEM TẤT CẢ (selectedFolderId === null || '') -> HIỂN THỊ TỪNG THƯ MỤC LÀ TITLE, KẺ NGANG RA, BÊN DƯỚI LÀ BÀI GIẢNG THUỘC TỆP ĐÓ */}
          {(selectedFolderId === null || selectedFolderId === '') &&
            (() => {
              const unorganizedLectures = lectures.filter((l) => !l.folderId)
              const totalLectures = lectures.length

              if (totalLectures === 0 && folders.length === 0) {
                return (
                  <div className='border border-dashed border-stone-400 p-16 text-center'>
                    <h3 className='text-3xl font-medium text-emerald-950 font-display'>
                      Thư viện còn trống
                    </h3>
                    <p className='my-3 font-sans text-sm text-stone-500'>
                      {search
                        ? 'Không tìm thấy bài giảng phù hợp với từ khóa.'
                        : 'Tạo bài giảng đầu tiên từ một prompt hoặc canvas trống.'}
                    </p>
                  </div>
                )
              }

              return (
                <div className='space-y-12'>
                  {/* 1. HIỂN THỊ CÁC THƯ MỤC CÓ SẴN */}
                  {folders.map((folder) => {
                    const folderLectures = lectures.filter(
                      (l) => l.folderId === folder._id
                    )
                    // Nếu đang tìm kiếm và thư mục này không có kết quả khớp, ẩn đi
                    if (search && folderLectures.length === 0) return null

                    return (
                      <section key={folder._id}>
                        {/* Tiêu đề thư mục */}
                        <div className='flex items-baseline justify-between pb-2'>
                          <div className='flex items-center gap-3'>
                            <h2 className='text-2xl font-medium text-emerald-950 font-display flex items-center gap-2'>
                              <span>📁</span>
                              <span>{folder.name}</span>
                            </h2>
                            <span className='border border-stone-300 bg-stone-100 px-2 py-0.5 font-mono text-xs font-semibold text-stone-600'>
                              {folderLectures.length} bài giảng
                            </span>
                          </div>
                          <button
                            type='button'
                            onClick={() => openEditFolderModal(folder)}
                            className='flex items-center gap-1.5 border border-stone-300 bg-white px-2.5 py-1 font-sans text-xs font-semibold text-stone-600 transition hover:border-stone-400 hover:text-emerald-950'
                            title='Đổi tên / Xóa thư mục'
                          >
                            <span>✏️</span>
                            <span>Tùy chọn</span>
                          </button>
                        </div>

                        {/* Đường kẻ ngang */}
                        <div className='h-[1.5px] w-full bg-stone-300 mb-6'></div>

                        {/* Danh sách bài giảng thuộc thư mục này */}
                        {folderLectures.length > 0 ? (
                          <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-3'>
                            {folderLectures.map(renderLectureCard)}
                          </div>
                        ) : (
                          <div className='border border-dashed border-stone-300 bg-stone-50/50 p-8 text-center'>
                            <p className='text-xs text-stone-500'>
                              Thư mục <strong>"{folder.name}"</strong> chưa có
                              bài giảng nào. Nhấn chuột phải vào bài giảng bất
                              kỳ và chọn <strong>"Chuyển thư mục"</strong> để
                              đưa vào đây.
                            </p>
                          </div>
                        )}
                      </section>
                    )
                  })}

                  {/* 2. HIỂN THỊ PHẦN "CHƯA PHÂN LOẠI" NẾU CÓ BÀI GIẢNG HOẶC KHI CÓ THƯ MỤC */}
                  {(unorganizedLectures.length > 0 || folders.length > 0) &&
                    (!search || unorganizedLectures.length > 0) && (
                      <section>
                        {/* Tiêu đề Chưa phân loại */}
                        <div className='flex items-baseline justify-between pb-2'>
                          <div className='flex items-center gap-3'>
                            <h2 className='text-2xl font-medium text-emerald-950 font-display flex items-center gap-2'>
                              <span>📄</span>
                              <span>
                                {folders.length > 0
                                  ? 'Bài giảng chưa phân loại'
                                  : 'Tất cả bài giảng'}
                              </span>
                            </h2>
                            <span className='border border-stone-300 bg-stone-100 px-2 py-0.5 font-mono text-xs font-semibold text-stone-600'>
                              {unorganizedLectures.length} bài giảng
                            </span>
                          </div>
                        </div>

                        {/* Đường kẻ ngang */}
                        <div className='h-[1.5px] w-full bg-stone-300 mb-6'></div>

                        {/* Danh sách bài giảng */}
                        {unorganizedLectures.length > 0 ? (
                          <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-3'>
                            {unorganizedLectures.map(renderLectureCard)}
                          </div>
                        ) : (
                          <div className='border border-dashed border-stone-300 bg-stone-50/50 p-8 text-center'>
                            <p className='text-xs text-stone-500'>
                              Tất cả bài giảng đã được xếp vào các thư mục.
                            </p>
                          </div>
                        )}
                      </section>
                    )}
                </div>
              )
            })()}
        </div>
      )}

      {/* MENU CHUỘT PHẢI (CUSTOM CONTEXT MENU) */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          style={{
            top: Math.min(contextMenu.y, window.innerHeight - 260),
            left: Math.min(contextMenu.x, window.innerWidth - 240)
          }}
          className='fixed z-50 w-56 border border-stone-300 bg-white p-1.5 shadow-2xl font-sans text-xs text-stone-800'
        >
          <div className='border-b border-stone-200 px-3 py-2 font-bold text-emerald-950 truncate'>
            {contextMenu.lecture.title}
          </div>

          {activeViewMode === 'trash' ? (
            <div className='p-1'>
              <div className='px-3 py-1.5 text-[11px] text-stone-500 border-b border-stone-100'>
                ⏳ Còn {getDaysRemaining(contextMenu.lecture.deletedAt)} ngày tự
                động xóa
              </div>
              <button
                type='button'
                onClick={() => {
                  void handleRestoreLecture(contextMenu.lecture._id)
                  setContextMenu(null)
                }}
                className='mt-1 flex w-full items-center gap-2 px-3 py-2 text-left font-bold text-emerald-800 hover:bg-emerald-50 transition'
              >
                <span>♻️</span>
                <span>Khôi phục bài giảng</span>
              </button>
            </div>
          ) : (
            <div className='space-y-0.5 py-1'>
              {/* 1. Mở chỉnh sửa */}
              <button
                type='button'
                onClick={() => {
                  handleOpen(contextMenu.lecture)
                  setContextMenu(null)
                }}
                className='flex w-full items-center gap-2 px-3 py-2 text-left font-medium hover:bg-stone-100 hover:text-emerald-950 transition'
              >
                <span>✏️</span>
                <span>Mở chỉnh sửa</span>
              </button>

              {/* 2. Trình chiếu */}
              <button
                type='button'
                onClick={() => {
                  handlePresent(contextMenu.lecture)
                  setContextMenu(null)
                }}
                className='flex w-full items-center gap-2 px-3 py-2 text-left font-medium hover:bg-stone-100 hover:text-emerald-950 transition'
              >
                <span>🖥️</span>
                <span>Trình chiếu bài giảng</span>
              </button>

              {/* Xuất bài giảng (Modal chọn xuất đơn PNG hoặc toàn bộ PDF) */}
              <button
                type='button'
                onClick={() => {
                  setLectureToExport(contextMenu.lecture)
                  setContextMenu(null)
                }}
                className='flex w-full items-center gap-2 px-3 py-2 text-left font-medium hover:bg-stone-100 hover:text-emerald-950 transition'
              >
                <span>📤</span>
                <span>Xuất bài giảng...</span>
              </button>

              {/* 3. Chuyển vào thư mục */}
              <button
                type='button'
                onClick={() => {
                  setMovingLecture(contextMenu.lecture)
                  setTargetFolderId(contextMenu.lecture.folderId || '')
                  setContextMenu(null)
                }}
                className='flex w-full items-center gap-2 px-3 py-2 text-left font-medium hover:bg-stone-100 hover:text-emerald-950 transition'
              >
                <span>📁</span>
                <span>Chuyển vào thư mục</span>
              </button>

              {/* 4. Nhân bản */}
              <button
                type='button'
                onClick={() => {
                  void handleDuplicateLecture(contextMenu.lecture._id)
                  setContextMenu(null)
                }}
                className='flex w-full items-center gap-2 px-3 py-2 text-left font-medium hover:bg-stone-100 hover:text-emerald-950 transition'
              >
                <span>📋</span>
                <span>Nhân bản bài giảng</span>
              </button>

              {/* 5. Đổi tên bài giảng */}
              <button
                type='button'
                onClick={() => {
                  setRenamingLecture(contextMenu.lecture)
                  setRenameTitleInput(contextMenu.lecture.title)
                  setContextMenu(null)
                }}
                className='flex w-full items-center gap-2 px-3 py-2 text-left font-medium hover:bg-stone-100 hover:text-emerald-950 transition'
              >
                <span>🏷️</span>
                <span>Đổi tên bài giảng</span>
              </button>

              {/* 6. Chuyển vào thùng rác (Soft Delete) */}
              <div className='border-t border-stone-200 pt-1'>
                <button
                  type='button'
                  onClick={() => {
                    setLectureToDelete(contextMenu.lecture._id)
                    setContextMenu(null)
                  }}
                  className='flex w-full items-center gap-2 px-3 py-2 text-left font-medium text-orange-800 hover:bg-orange-50 transition'
                >
                  <span>🗑️</span>
                  <span>Chuyển vào thùng rác</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL TẠO & ĐỔI TÊN THƯ MỤC */}
      <Modal
        open={isFolderModalOpen}
        onClose={() => setIsFolderModalOpen(false)}
        title={folderToEdit ? 'Đổi tên thư mục' : 'Tạo thư mục mới'}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void handleSaveFolder()
          }}
          className='space-y-4 font-sans'
        >
          <div>
            <label
              htmlFor='folder-name-input'
              className='block text-xs font-bold text-stone-700 uppercase tracking-wider'
            >
              Tên thư mục
            </label>
            <input
              id='folder-name-input'
              className='mt-2 w-full border border-stone-300 bg-white p-3 text-xs outline-orange-700'
              placeholder='Nhập tên thư mục...'
              value={folderNameInput}
              onChange={(e) => setFolderNameInput(e.target.value)}
              autoFocus
            />
          </div>

          {folderError && (
            <div className='text-xs font-semibold text-red-700'>
              ❌ {folderError}
            </div>
          )}

          <div className='mt-6 flex items-center justify-between gap-2 pt-2'>
            {folderToEdit ? (
              <button
                type='button'
                className='text-xs font-semibold text-red-700 hover:text-red-900 transition'
                onClick={() => {
                  setIsFolderModalOpen(false)
                  setFolderToDelete(folderToEdit)
                }}
              >
                🗑️ Xóa thư mục này
              </button>
            ) : (
              <div />
            )}

            <div className='flex gap-2'>
              <button
                type='button'
                className='border border-stone-400 px-4 py-2.5 text-xs font-semibold hover:bg-stone-100'
                onClick={() => setIsFolderModalOpen(false)}
                disabled={isFolderSubmitting}
              >
                Hủy
              </button>
              <button
                type='submit'
                className='bg-orange-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-orange-800 disabled:opacity-50'
                disabled={isFolderSubmitting}
              >
                {isFolderSubmitting ? 'Đang lưu...' : 'Lưu thư mục'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* MODAL ĐỔI TÊN BÀI GIẢNG */}
      <Modal
        open={Boolean(renamingLecture)}
        onClose={() => setRenamingLecture(null)}
        title='Đổi tên bài giảng'
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void handleRenameLecture()
          }}
          className='space-y-4 font-sans'
        >
          <div>
            <label
              htmlFor='rename-title-input'
              className='block text-xs font-bold text-stone-700 uppercase tracking-wider'
            >
              Tiêu đề mới
            </label>
            <input
              id='rename-title-input'
              className='mt-2 w-full border border-stone-300 bg-white p-3 text-xs outline-orange-700'
              value={renameTitleInput}
              onChange={(e) => setRenameTitleInput(e.target.value)}
              autoFocus
            />
          </div>

          <div className='mt-6 flex justify-end gap-2 pt-2'>
            <button
              type='button'
              className='border border-stone-400 px-4 py-2.5 text-xs font-semibold hover:bg-stone-100'
              onClick={() => setRenamingLecture(null)}
            >
              Hủy
            </button>
            <button
              type='submit'
              className='bg-orange-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-orange-800'
            >
              Cập nhật tên
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL CHUYỂN BÀI GIẢNG VÀO THƯ MỤC */}
      <Modal
        open={Boolean(movingLecture)}
        onClose={() => setMovingLecture(null)}
        title='Chuyển bài giảng vào thư mục'
      >
        <div className='space-y-4 font-sans'>
          <p className='text-xs text-stone-600'>
            Chọn thư mục bạn muốn chuyển bài giảng{' '}
            <strong className='text-emerald-950'>{movingLecture?.title}</strong>{' '}
            vào:
          </p>

          <div className='space-y-1.5 max-h-56 overflow-y-auto pr-1'>
            {/* Thư mục gốc / Không phân loại */}
            <button
              type='button'
              onClick={() => setTargetFolderId('')}
              className={`flex w-full items-center justify-between border p-3 text-xs font-semibold transition ${
                targetFolderId === ''
                  ? 'border-emerald-950 bg-stone-200/80 font-bold text-emerald-950'
                  : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50'
              }`}
            >
              <span>📄 Không thuộc thư mục nào (Gốc)</span>
              {targetFolderId === '' && <span>✓</span>}
            </button>

            {folders.map((folder) => (
              <button
                key={folder._id}
                type='button'
                onClick={() => setTargetFolderId(folder._id)}
                className={`flex w-full items-center justify-between border p-3 text-xs font-semibold transition ${
                  targetFolderId === folder._id
                    ? 'border-emerald-950 bg-stone-200/80 font-bold text-emerald-950'
                    : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50'
                }`}
              >
                <span>📁 {folder.name}</span>
                {targetFolderId === folder._id && <span>✓</span>}
              </button>
            ))}
          </div>

          <div className='mt-6 flex justify-end gap-2 pt-3 border-t border-stone-200'>
            <button
              type='button'
              className='border border-stone-400 px-4 py-2.5 text-xs font-semibold hover:bg-stone-100'
              onClick={() => setMovingLecture(null)}
            >
              Hủy
            </button>
            <button
              type='button'
              onClick={() => void handleMoveLectureToFolder()}
              className='bg-orange-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-orange-800'
            >
              Xác nhận chuyển
            </button>
          </div>
        </div>
      </Modal>

      {/* DIALOG XÁC NHẬN CHUYỂN VÀO THÙNG RÁC (SOFT DELETE - ĐẾM NGƯỢC 30 NGÀY) */}
      <ConfirmDialog
        open={Boolean(lectureToDelete)}
        title='Chuyển bài giảng vào Thùng rác'
        message='Bài giảng sẽ được chuyển vào Thùng rác và đếm ngược 30 ngày trước khi hệ thống tự động xóa vĩnh viễn. Trong 30 ngày này, bạn có thể khôi phục lại bài giảng bất cứ lúc nào.'
        confirmLabel='Chuyển vào thùng rác'
        cancelLabel='Hủy'
        onConfirm={() => void handleConfirmDeleteLecture()}
        onCancel={() => setLectureToDelete(null)}
      />

      {/* DIALOG XÁC NHẬN XÓA THƯ MỤC */}
      <ConfirmDialog
        open={Boolean(folderToDelete)}
        title='Xác nhận xóa thư mục'
        message={`Bạn có chắc chắn muốn xóa thư mục "${folderToDelete?.name}" không? Các bài giảng bên trong sẽ trở về trạng thái chưa phân loại.`}
        confirmLabel='Xóa thư mục'
        cancelLabel='Hủy'
        onConfirm={() => void handleConfirmDeleteFolder()}
        onCancel={() => setFolderToDelete(null)}
      />

      {/* MODAL XUẤT BẢN BÀI GIẢNG */}
      <ExportModal
        open={Boolean(lectureToExport)}
        lecture={lectureToExport}
        onClose={() => setLectureToExport(null)}
        onSuccess={(msg) => notifySuccess(msg)}
        onError={(msg) => notifyError(msg)}
      />
    </div>
  )
}
