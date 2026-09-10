# Cấu trúc dự án — ABSlider

## Tổng quan

Cả thư mục **ABSlider** là **1 repository Git duy nhất** trên GitHub. Trong đó:
- Mã nguồn được quản lý tập trung trong 1 repo: thư mục gốc chứa `docs/`, hạ tầng Docker dev, thư mục `.github/` chứa workflows CI/CD chung.
- **Nơi host tách riêng độc lập**:
  - **`client`** (Frontend): Xây dựng bằng React + Vite, build thành static files và triển khai trên dịch vụ lưu trữ web tĩnh riêng biệt.
  - **`server`** (Backend): Xây dựng bằng Node.js + Express, đóng gói Docker container và triển khai trên VPS riêng cùng các dịch vụ phụ trợ (MongoDB, Redis, MinIO).
- Mỗi thư mục `client` và `server` tự sở hữu `package.json` và `tsconfig.json` riêng biệt, độc lập về dependencies và tooling.

```
ABSlider/                  # 1 Git repository duy nhất đẩy lên GitHub
  .github/                 # Workflows GitHub Actions (CI/CD) & template chung
  docs/                    # Tài liệu chung: đặc tả, convention, quy trình
  docs-template/           # Tài liệu tham khảo từ dự án trước (không sửa)
  docker-compose.dev.yml   # Môi trường dev dùng chung: MongoDB, Redis, MinIO
  client/                  # Frontend — React + Vite (package.json riêng, host riêng)
  server/                  # Backend — Node + Express (package.json riêng, host riêng trên VPS)
```

`docker-compose.dev.yml` ở gốc chạy các phần mềm hạ tầng cho dev local (MongoDB, Redis, MinIO) — xem chi tiết tại [conventions-be.md § Môi trường dev bằng Docker](conventions-be.md#6-cấu-hình-môi-trường). Cả `client` và `server` chỉ cần `docker compose -f docker-compose.dev.yml up -d` trước khi `npm run dev`.

---

## 1. Route tree — `client`

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

## 2. Cấu trúc thư mục — `client`

```
client/
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

## 3. Cấu trúc thư mục — `server`

```
server/
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
