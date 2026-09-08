# Cấu trúc dự án — ABSlider

## Tổng quan

Dự án tách thành **2 repo/workspace riêng biệt** (không dùng monorepo), mỗi repo mở độc lập trong VSCode để mỗi bên tự nhận đúng phiên bản TypeScript/tooling của mình:

```
ABSlider/                  # thư mục cha, không phải 1 repo git chung
  docs/                    # tài liệu chung: đặc tả, convention, quy trình
  docs-template/           # tài liệu tham khảo từ dự án trước (không sửa)
  docker-compose.yml       # môi trường dev dùng chung: MongoDB, Redis, MinIO
  ABSlider-FE/              # repo riêng — React + Vite
  ABSlider-BE/              # repo riêng — Node + Express
```

`docker-compose.yml` ở gốc chạy các phần mềm hạ tầng cho dev local (MongoDB, Redis, MinIO) — xem chi tiết tại [conventions-be.md § Môi trường dev bằng Docker](conventions-be.md#6-cấu-hình-môi-trường). Cả `ABSlider-FE` và `ABSlider-BE` chỉ cần `docker compose up -d` trước khi `npm run dev`.

---

## 1. Route tree — `ABSlider-FE`

```
src/app/
├── routes/
│   ├── (auth)/                # nhóm route không có layout chính, UC001-005
│   │   ├── sign-in.tsx         # 🔑 Đăng nhập — UC002
│   │   ├── sign-up.tsx         # 📝 Đăng ký + xác thực OTP — UC001
│   │   └── verify-otp.tsx      # Nhập mã OTP sau đăng ký
│   │
│   ├── (main)/                 # layout chính có sidebar/topbar, cần đăng nhập
│   │   ├── library.tsx         # 📚 Thư viện bài giảng — UC020, UC022, UC027
│   │   ├── profile.tsx         # 👤 Hồ sơ cá nhân — UC004, UC005
│   │   │
│   │   ├── lectures/
│   │   │   ├── new.tsx         # ✏️ Nhập Prompt → sinh Outline — UC006
│   │   │   ├── pattern.tsx     # 🎨 Chọn Pattern thiết kế — UC007
│   │   │   └── [lectureId]/
│   │   │       └── edit.tsx    # 🖼️ Slide Editor chính — UC008-017, UC029
│   │   │
│   │   └── admin/              # chỉ render nếu role === 'admin' — UC030-032
│   │       ├── users.tsx       # 🛡️ Quản lý người dùng — UC030
│   │       ├── ai-usage.tsx    # 📊 Log AI Usage — UC031
│   │       └── credit-config.tsx # 💳 Cấu hình Credit — UC032
│   │
│   └── present/
│       └── [lectureId].tsx    # 🎬 Presentation Mode (fullscreen) — UC018-019
```

### Mô tả từng route

| Route | Mục đích | Feature module |
|---|---|---|
| `(auth)/sign-in` | Form đăng nhập email/password | `features/auth` |
| `(auth)/sign-up` | Form đăng ký, gửi OTP qua email | `features/auth` |
| `(main)/library` | Danh sách bài giảng + thư mục, tìm kiếm/sắp xếp | `features/library` |
| `(main)/lectures/new` | Chat AI nhập prompt, chỉnh Outline dạng cây | `features/lecture-generation` |
| `(main)/lectures/pattern` | Chọn/preview Pattern thiết kế trước khi sinh slide | `features/lecture-generation` |
| `(main)/lectures/[id]/edit` | Slide Editor: canvas, toolbar, chat AI sửa slide, Undo/Redo | `features/slide-editor`, `features/slide-management` |
| `present/[id]` | Chế độ trình chiếu fullscreen, điều hướng bằng phím | `features/presentation` |
| `(main)/admin/*` | 3 màn quản trị, chỉ Admin truy cập được | `features/admin` |

---

## 2. Cấu trúc thư mục — `ABSlider-FE`

```
ABSlider-FE/
  public/
  src/
    app/                   # routes (bảng trên), providers, layout gốc, entrypoint
    features/
      auth/                # UC001-005
        components/
        hooks/
        api/
        store/
        types/
      lecture-generation/  # UC006-008
      slide-editor/        # UC009-013
      slide-management/    # UC014-017
      presentation/        # UC018-019
      library/             # UC020-028
      export/              # UC029
      admin/               # UC030-032
    components/ui/         # design-system dùng chung
    hooks/                 # hook dùng chung nhiều feature
    lib/                   # axios instance, query client, helper chung
    assets/
    styles/
  .env.example
  vite.config.ts
  tsconfig.json
  package.json
```

### Component Library dùng chung (`components/ui/`)

| Component | Props chính | Mô tả |
|---|---|---|
| `Button` | `variant`, `isLoading`, `onClick` | Button chuẩn có state loading |
| `Modal` | `open`, `onClose`, `title` | Modal dùng cho xác nhận xóa, tạo thư mục... |
| `Input` | `label`, `error`, `...inputProps` | Input có hiển thị lỗi validate |
| `Toast` (provider) | mount 1 lần ở `app/` | Thông báo thành công/lỗi toàn app |
| `ConfirmDialog` | `message`, `onConfirm` | Hộp thoại xác nhận (xóa slide, đăng xuất...) |
| `Dropdown` | `options`, `value`, `onChange` | Dùng cho sắp xếp thư viện, chọn font/màu |

### Hooks theo feature (tóm tắt)

| Hook | Feature | Trả về |
|---|---|---|
| `useAuth` | auth | `user`, `login`, `logout`, `isAuthenticated` |
| `useLectures` / `useDeleteLecture` | library | danh sách bài giảng, mutation xóa (TanStack Query) |
| `useOutlineGeneration` | lecture-generation | outline hiện tại, `regenerate()`, `updateNode()` |
| `useEditorStore` (Zustand) | slide-editor | slide đang chọn, Undo/Redo stack |
| `useAutosave` | slide-editor | debounce lưu, trạng thái `saving/saved/offline` |
| `useExportLecture` | export | `exportCurrentSlide()`, `exportAll()` |
| `useAdminUsers` / `useCreditConfig` | admin | CRUD user, cấu hình giá credit |

---

## 3. Cấu trúc thư mục — `ABSlider-BE`

```
ABSlider-BE/
  src/
    config/                # đọc & validate biến môi trường
    routes/                # khai báo endpoint theo resource
    controllers/
    services/               # business logic (gọi Mongo, Redis, Gemini API, MinIO)
    models/                 # schema Mongoose
    middlewares/            # auth, requireAdmin, error handler, validate
    validators/              # schema zod theo resource
    utils/
    types/
  scripts/                  # seed dữ liệu mẫu
  .env.example
  tsconfig.json
  package.json
```

### MongoDB Collections

| Collection | Ánh xạ use case | Mô tả |
|---|---|---|
| `users` | UC001-005, UC030 | Tài khoản, role (`user`/`admin`), Credit AI hiện có |
| `lectures` | UC006-029 | Bài giảng: title, folderId, slides (JSON), pattern, deletedAt (soft-delete) |
| `folders` | UC022-024 | Thư mục tổ chức bài giảng |
| `aiUsageLogs` | UC008, UC031 | Log mỗi lượt gọi AI: userId, prompt, slideCount, creditSpent, createdAt |
| `creditConfigs` | UC032 | Giá credit theo từng hành động AI (singleton document) |

### Redis — dùng cho

| Mục đích | Key pattern |
|---|---|
| Cache session/refresh token blacklist | `session:{userId}` |
| Rate-limit gọi Gemini API theo user | `ratelimit:ai:{userId}` |
| Lưu tạm OTP đăng ký (TTL 5 phút) | `otp:{email}` |

### MinIO — Bucket `media`

| Thuộc tính | Giá trị |
|---|---|
| Bucket | `media` |
| Nội dung | Ảnh người dùng upload vào slide (UC011) |
| Permission | Đọc public qua presigned URL, ghi chỉ qua Backend (server key) |

---

## 4. Ghi chú

- `ABSlider-FE` và `ABSlider-BE` có `package.json`, `tsconfig.json`, cấu hình ESLint/Prettier **độc lập** — không chia sẻ `node_modules` hay config chung.
- Thư mục `docs/` ở gốc giữ tài liệu không thuộc riêng FE hay BE: đặc tả dự án (`dtyc.pdf`, `ktda.pdf`), convention (`conventions-fe.md`, `conventions-be.md`), quy trình làm việc (`github-workflow.md`) và chính tài liệu này.
- Khi 2 repo `ABSlider-FE`/`ABSlider-BE` được tạo thật trên GitHub, mỗi repo tự mang theo `.github/` riêng (workflow CI, template PR/issue) — xem [github-workflow.md](github-workflow.md).
