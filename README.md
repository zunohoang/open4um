# Hướng dẫn Khởi chạy Dự án ABSlider

Hệ thống **ABSlider** là nền tảng trực quan kết hợp trí tuệ nhân tạo (AI) để xây dựng, thiết kế và trình chiếu bài giảng chuyên nghiệp.

Dự án gồm 2 phần độc lập:
- **`ABSlider-BE`**: Backend REST API (Node.js, Express, MongoDB, Redis, MinIO S3, Google Gemini AI).
- **`ABSlider-FE`**: Frontend Web Studio (React 19, Vite, Tailwind CSS, Zustand, TanStack Query).
- **Hạ tầng cục bộ**: Docker Compose chứa MongoDB 8, Redis 7 và MinIO (Object Storage).

---

## 1. Yêu cầu Hệ thống (Prerequisites)

Trước khi bắt đầu, hãy đảm bảo máy tính của bạn đã cài đặt:
- **Node.js**: Phiên bản `>= 20.x` (khuyến nghị `22.x LTS`).
- **npm**: `>= 10.x` (đi kèm với Node.js).
- **Docker & Docker Compose**: Để khởi chạy các dịch vụ database và lưu trữ media cục bộ.

---

## 2. Chuẩn bị File Môi trường (.env)

Hệ thống sử dụng 3 file cấu hình môi trường:

### 2.1. File `.env` tại thư mục gốc (`/ABSlider/.env`)
Dùng cho Docker Compose khởi tạo dịch vụ:
```env
MONGO_USER=mongodb
MONGO_PASSWORD=change-me
DB_PORT=27017

REDIS_PORT=6379

MINIO_PORT=9000
MINIO_CONSOLE_PORT=9001
MINIO_USER=miniouser
MINIO_PASSWORD=change-me
```
*(Nếu chưa có, bạn có thể sao chép từ `.env.example` ở thư mục gốc: `cp .env.example .env`)*

---

### 2.2. File `.env` cho Backend (`/ABSlider/ABSlider-BE/.env`)
Tạo hoặc kiểm tra file `ABSlider-BE/.env` với nội dung:
```env
NODE_ENV=development
PORT=4000
MONGO_URI=mongodb://mongodb:change-me@localhost:27017/absliderdb?authSource=admin
REDIS_URL=redis://localhost:6379
JWT_SECRET=change-me-in-production-super-secret-key-12345
GEMINI_API_KEY=your_gemini_api_key_here
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=miniouser
MINIO_SECRET_KEY=change-me

# Tài khoản Admin khởi tạo (Seed)
ADMIN_EMAIL=admin@abslider.com
ADMIN_PASSWORD=admin123456
ADMIN_NAME=Admin ABSlider
```
> [!TIP]
> Điền API Key của Google Gemini vào `GEMINI_API_KEY` để kích hoạt tính năng sinh outline bài giảng và tạo nội dung slide bằng AI.

---

### 2.3. File `.env` cho Frontend (`/ABSlider/ABSlider-FE/.env`)
Tạo hoặc kiểm tra file `ABSlider-FE/.env`:
```env
VITE_API_BASE_URL=http://localhost:4000/api/v1
```

---

## 3. Các Bước Khởi Chạy Dự Án (Quickstart)

### Bước 1: Khởi động Hạ tầng Dịch vụ qua Docker
Mở terminal tại thư mục gốc (`ABSlider/`) và chạy:

```bash
docker compose -f docker-compose.dev.yml up -d
```

Kiểm tra trạng thái các container đang chạy:
```bash
docker compose -f docker-compose.dev.yml ps
```
Cả 3 dịch vụ `absliderdb_mongo`, `abslider_redis`, `abslider_minio` phải ở trạng thái `Up` hoặc `running`.

---

### Bước 2: Cài đặt và Chạy Backend (`ABSlider-BE`)
Mở một cửa sổ terminal mới:

```bash
cd ABSlider-BE

# Cài đặt các gói phụ thuộc
npm install

# Khởi chạy server ở chế độ phát triển
npm run dev
```

- Server backend sẽ lắng nghe tại: **`http://localhost:4000`**
- Hệ thống sẽ tự động:
  - Kết nối MongoDB, Redis và MinIO.
  - Chạy migration database (nếu có các file migration mới).
  - Khởi tạo cấu hình credit và tài khoản **Admin** mặc định (`admin@abslider.com`).
  - Kích hoạt lịch CronJob tự động dọn dẹp bài giảng thùng rác và tài khoản bị khóa sau 30 ngày.

---

### Bước 3: Cài đặt và Chạy Frontend (`ABSlider-FE`)
Mở tiếp một cửa sổ terminal khác:

```bash
cd ABSlider-FE

# Cài đặt các gói phụ thuộc
npm install

# Khởi chạy frontend web app
npm run dev
```

- Trình duyệt sẽ mở hoặc truy cập tại: **`http://localhost:5173`**

---

## 4. Tài Khoản Đăng Nhập Mặc Định

| Loại tài khoản | Email | Mật khẩu | Quyền hạn & Chức năng |
|---|---|---|---|
| **Quản trị viên (Admin)** | `admin@abslider.com` | `admin123456` | Toàn quyền quản trị hệ thống, quản lý người dùng (tạo tài khoản, sửa credit, khóa/khôi phục), cấu hình giá credit và xem nhật ký AI. |
| **Người dùng (User)** | Tự đăng ký qua form `Đăng ký` trên web | *(Tùy chọn khi đăng ký)* | Soạn thảo slide, sinh bài giảng bằng AI, quản lý thư mục, xuất bài giảng (PDF/PNG), trình chiếu toàn màn hình. |

---

## 5. Danh Mục Các Lệnh Thường Dùng

### Thư mục gốc (`ABSlider/`)
- `docker compose -f docker-compose.dev.yml up -d`: Khởi động MongoDB, Redis, MinIO dưới nền.
- `docker compose -f docker-compose.dev.yml down`: Dừng toàn bộ các container dịch vụ.
- `docker compose -f docker-compose.dev.yml logs -f`: Xem log hoạt động của các container.

### Backend (`ABSlider-BE/`)
- `npm run dev`: Chạy server dev với hot-reload (`tsx watch`).
- `npm run build`: Kiểm tra kiểu và biên dịch TypeScript sang JavaScript (`dist/`).
- `npm run start`: Chạy bản build production (`node dist/server.js`).
- `npm run lint`: Kiểm tra và sửa lỗi cú pháp code theo ESLint/Prettier.
- `npm run migrate`: Chạy các file migration dữ liệu thủ công.

### Frontend (`ABSlider-FE/`)
- `npm run dev`: Chạy máy chủ giao diện với Vite hot-reload.
- `npm run build`: Kiểm tra kiểu TypeScript và đóng gói bundle production (`dist/`).
- `npm run preview`: Xem thử bản build production trên máy local.
- `npm run lint`: Quét và kiểm tra lỗi định dạng code.

---

## 6. Xử Lý Sự Cố Thường Gặp (Troubleshooting)

1. **Lỗi kết nối MongoDB (`MongoServerError: Authentication failed`)**:
   - Đảm bảo thông tin `MONGO_USER` và `MONGO_PASSWORD` trong file `.env` ở thư mục gốc trùng khớp với chuỗi kết nối `MONGO_URI` trong `ABSlider-BE/.env`.
   - Nếu bạn đổi mật khẩu sau khi volume MongoDB đã tạo, cần xóa volume cũ: `docker volume rm abslider_mongodata` rồi chạy lại `docker compose up -d`.

2. **Xung đột cổng (Port already in use)**:
   - Đảm bảo các cổng sau đang trống trước khi chạy:
     - `27017`: MongoDB
     - `6379`: Redis
     - `9000` / `9001`: MinIO Server & MinIO Console
     - `4000`: Backend API
     - `5173`: Frontend Vite Dev Server

3. **Giao diện quản trị MinIO Console**:
   - Truy cập tại: `http://localhost:9001`
   - Đăng nhập: Username `miniouser`, Password `change-me`.
   - Dùng để theo dõi bucket lưu trữ tệp tin xuất bài giảng và media.
