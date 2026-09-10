# Frontend Conventions — client

## Tổng quan

Tài liệu định nghĩa quy ước code của client. Mục tiêu: code dễ đọc, nhất quán giữa các thành viên, và dễ mở rộng theo từng nhóm use case (UC001-032). Stack: React 19 + TypeScript + Vite + TailwindCSS v4 + Zustand + TanStack Query + Vitest/React Testing Library.

---

## 1. Quy ước đặt tên file

| Loại | Convention | Ví dụ |
|---|---|---|
| Component | `PascalCase.tsx` | `SlideCanvas.tsx`, `LectureCard.tsx` |
| Hook | `camelCase.ts`, tiền tố `use` | `useAuth.ts`, `useLectures.ts` |
| Zustand store | `camelCase.store.ts` | `editor.store.ts` |
| API client | `camelCase.api.ts` | `lecture.api.ts` |
| Query hook (TanStack) | `camelCase.queries.ts` | `lecture.queries.ts` |
| Utility | `camelCase.ts` | `formatDate.ts` |
| Type definition | `camelCase.types.ts` | `lecture.types.ts` |
| Test | cùng tên file nguồn + `.test.ts(x)` | `SlideCanvas.test.tsx` |

Không dùng Hungarian notation, không viết tắt tùy tiện (trừ các từ đã thống nhất: `id`, `url`, `api`, `ui`).

---

## 2. Cấu trúc theo feature

```
src/
  app/                  # routing, providers, layout gốc, entrypoint
  features/
    auth/                 # UC001-005
      components/
      hooks/
      api/
      store/
      types/
    lecture-generation/   # UC006-008: outline, pattern, sinh slide bằng AI
    slide-editor/         # UC009-013: chỉnh sửa text/ảnh/đối tượng, undo-redo
    slide-management/     # UC014-017: thêm/xóa/nhân bản/di chuyển slide
    presentation/         # UC018-019: trình chiếu, điều hướng
    library/              # UC020-028: thư viện, thư mục, tìm kiếm, lưu tự động
    export/                # UC029: xuất PNG/PDF
    admin/                 # UC030-032: quản lý user, AI usage, credit
  components/ui/         # design-system dùng chung (Button, Modal, Input...)
  hooks/                  # hook dùng chung nhiều feature
  lib/                    # axios instance, query client, helper chung
  assets/
  styles/
```

Mỗi feature tự chứa component/hook/api/store riêng; chỉ đưa lên `components/ui` hoặc `hooks/` khi được ≥2 feature dùng chung.

---

## 3. Quy ước Component

### Cấu trúc file Component

```tsx
// 1. Imports (external → alias nội bộ @/ → tương đối, cách nhau 1 dòng trắng)
import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuthStore } from '@/features/auth/store/auth.store'
import { useDeleteLecture } from '@/features/library/api/lecture.queries'

// 2. Types (đặt cạnh component nếu chỉ dùng ở đây)
interface LectureCardProps {
  lecture: Lecture
  onOpen: (id: string) => void
}

// 3. Component (named export, không default cho component tái sử dụng)
export const LectureCard = ({ lecture, onOpen }: LectureCardProps) => {
  // 3a. Hooks trước (store → query/mutation → state → ref → memo/callback → effect)
  const { userId } = useAuthStore()
  const { mutate: deleteLecture, isPending } = useDeleteLecture()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  // 3b. Handlers / logic
  const handleDelete = useCallback(() => {
    deleteLecture(lecture.id)
  }, [deleteLecture, lecture.id])

  // 3c. JSX return
  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
      <span className="text-sm font-medium">{lecture.title}</span>
    </div>
  )
}
```

### Quy tắc Component

- **1 component = 1 file** — không để nhiều component lớn trong cùng file.
- Tên component phải **mô tả chức năng**, không dùng tên generic (`Item`, `Box`, `Container`).
- Props destructuring ngay trong function signature; props type đặt tên `<Component>Props`.
- Không dùng `any` cho props — luôn định nghĩa interface rõ ràng.

---

## 4. Quy ước Hook

```ts
// features/library/hooks/useLectureSearch.ts
import { useMemo, useState } from 'react'
import type { Lecture } from '../types/lecture.types'

export const useLectureSearch = (lectures: Lecture[]) => {
  const [keyword, setKeyword] = useState('')
  const [sortBy, setSortBy] = useState<'az' | 'newest' | 'oldest'>('newest')

  const filtered = useMemo(() => {
    return lectures
      .filter((l) => l.title.toLowerCase().includes(keyword.toLowerCase()))
      .sort((a, b) => sortComparator(sortBy, a, b))
  }, [lectures, keyword, sortBy])

  return { filtered, keyword, setKeyword, sortBy, setSortBy }
}
```

**Quy tắc Hook:**
- Luôn bắt đầu bằng `use`.
- Return object có tên field rõ nghĩa (không return array trừ khi giống style `useState`).
- Không gọi `axios`/API trực tiếp trong component — luôn qua hook (`features/*/api/*.queries.ts`).

---

## 5. Quy ước lớp API (Service)

```ts
// features/library/api/lecture.api.ts
import { apiClient } from '@/lib/api'
import type { Lecture } from '../types/lecture.types'

export const lectureApi = {
  list: async (): Promise<Lecture[]> => {
    const { data } = await apiClient.get('/lectures')
    return data.data
  },
  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/lectures/${id}`)
  },
}
```

```ts
// features/library/api/lecture.queries.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { lectureApi } from './lecture.api'

export const lectureKeys = {
  all: ['lectures'] as const,
  detail: (id: string) => ['lectures', id] as const,
}

export const useLectures = () =>
  useQuery({ queryKey: lectureKeys.all, queryFn: lectureApi.list })

export const useDeleteLecture = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: lectureApi.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: lectureKeys.all }),
  })
}
```

**Quy tắc Service:**
- `src/lib/api.ts` khởi tạo **1 axios instance dùng chung** (base URL, interceptor gắn JWT, xử lý lỗi 401 → logout).
- Mỗi resource 1 file `*.api.ts` chỉ chứa hàm gọi HTTP thuần, không chứa logic UI.
- Mọi lỗi API để nguyên cho TanStack Query xử lý (`isError`, `error`) — không catch nuốt lỗi trong file `.api.ts`.

---

## 6. Quy ước Zustand Store

```ts
// features/slide-editor/store/editor.store.ts
import { create } from 'zustand'

interface EditorState {
  activeSlideId: string | null
  undoStack: Command[]
  redoStack: Command[]
  setActiveSlide: (id: string) => void
  pushCommand: (command: Command) => void
  undo: () => void
}

export const useEditorStore = create<EditorState>((set, get) => ({
  activeSlideId: null,
  undoStack: [],
  redoStack: [],
  setActiveSlide: (id) => set({ activeSlideId: id }),
  pushCommand: (command) => set((s) => ({ undoStack: [...s.undoStack, command], redoStack: [] })),
  undo: () => {
    const { undoStack } = get()
    if (undoStack.length === 0) return
    // ... áp dụng command ngược lại, chuyển sang redoStack
  },
}))
```

**Quy tắc Zustand:**
- Chỉ chứa state phía **client thuần UI** (Slide Editor đang mở slide nào, Undo/Redo stack, trạng thái modal...).
- Mỗi store gắn với 1 feature (`editor.store.ts`, `auth.store.ts`) — không tạo 1 store "god object" dùng chung toàn app.
- Không đưa dữ liệu lấy từ server vào Zustand — đó là việc của TanStack Query.

---

## 7. Quy ước quản lý state (tổng quan)

| Loại state | Nơi lưu | Ví dụ |
|---|---|---|
| Auth session (user, token) | `auth.store` (Zustand) | `useAuthStore` |
| Dữ liệu từ server | TanStack Query | danh sách bài giảng, hồ sơ user, log AI Usage |
| Trạng thái Slide Editor (slide đang chọn, Undo/Redo) | `editor.store` (Zustand) | `useEditorStore` |
| Tương tác cục bộ 1 component | `useState` trong component | modal mở/đóng, input đang gõ |

Query key đặt theo mảng phân cấp (`['lectures']`, `['lectures', id]`), mutation luôn `invalidateQueries` đúng key liên quan.

---

## 8. Quy ước Styling (Tailwind)

TailwindCSS v4 tích hợp qua **plugin `@tailwindcss/vite`** thẳng vào `vite.config.ts` — **không dùng PostCSS** (không cần `postcss.config.js`/`tailwind.config.js` kiểu v3). Theme (màu, font, spacing...) khai báo bằng `@theme` ngay trong `src/index.css`.

### Thứ tự className khuyến nghị

```tsx
// 1. Layout (flex, grid, position) → 2. Sizing (w,h,p,m) → 3. Background
// → 4. Border → 5. Typography → 6. Hiệu ứng khác
<div className="flex items-center gap-2 w-full p-4 bg-white rounded-lg border border-gray-200 text-sm font-medium hover:shadow-md">
  ...
</div>
```

### Không dùng inline style tùy tiện

```tsx
// ❌ Tránh
<div style={{ display: 'flex', padding: 16 }}>

// ✅ Dùng Tailwind
<div className="flex p-4">

// ✅ Chỉ inline style khi giá trị động (VD: toạ độ kéo-thả object trên canvas)
<div style={{ transform: `translate(${x}px, ${y}px)` }}>
```

Dùng helper `cn()` (`clsx` + `tailwind-merge`) khi ghép class có điều kiện; màu/size/font lấy từ `tailwind.config.ts`, không hardcode mã màu rải rác.

---

## 9. Quy ước Error Handling

```tsx
const handleExport = async () => {
  try {
    setIsExporting(true)
    await exportLecture(lectureId)
    toast.success('Xuất bài giảng thành công')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Có lỗi xảy ra')
  } finally {
    setIsExporting(false)
  }
}
```

- Lớp API/service: để lỗi ném nguyên lên trên (không catch nuốt).
- Lớp UI: catch và hiển thị qua hệ thống toast dùng chung — không dùng `alert()`.
- Không để unhandled promise rejection.

---

## 10. Quy ước Import

```ts
// 1. React / thư viện core
import { useState } from 'react'
// 2. Thư viện ngoài
import { useQuery } from '@tanstack/react-query'
// 3. Alias nội bộ @/ (hooks, store, lib, components)
import { useAuthStore } from '@/features/auth/store/auth.store'
// 4. Import tương đối trong cùng feature
import { useLectureSearch } from '../hooks/useLectureSearch'
```

Alias `@/` trỏ vào `src/` (khai báo ở `tsconfig.json` và `vite.config.ts`).

---

## 11. Quy ước TypeScript

```ts
// interface cho object/props
interface Lecture {
  id: string
  title: string
  folderId?: string   // optional field dùng ?
}

// type alias cho union
type ExportFormat = 'png' | 'pdf'
type LecturePermission = 'edit' | 'view-only'
```

---

## 12. Tooling & Testing

- ESLint (typescript-eslint + `eslint-plugin-react-hooks`) + Prettier, chạy qua husky + lint-staged trước mỗi commit.
- Test colocate cạnh file nguồn (`SlideCanvas.test.tsx`), dùng Vitest + React Testing Library, ưu tiên test theo hành vi người dùng:

```tsx
test('hiển thị tên bài giảng trong LectureCard', () => {
  render(<LectureCard lecture={mockLecture} onOpen={vi.fn()} />)
  expect(screen.getByText(mockLecture.title)).toBeInTheDocument()
})
```
