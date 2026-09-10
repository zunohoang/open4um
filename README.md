# Hướng dẫn Khởi chạy Dự án ABSlider

Hệ thống **ABSlider** là nền tảng trực quan kết hợp trí tuệ nhân tạo (AI) để xây dựng, thiết kế và trình chiếu bài giảng chuyên nghiệp.

- **`client/`**: Frontend Web Studio (React, Vite, Tailwind CSS, Zustand, TanStack Query).
- **`server/`**: Backend REST API (Node.js, Express, MongoDB, Redis, MinIO S3, Gemini AI).

---

## 1. Chuẩn bị biến môi trường (.env)

Tạo file `.env` bằng cách copy từ file mẫu tương ứng (bỏ đuôi `.example`):
- **Thư mục gốc**: copy `.env.example` ➔ `.env`
- **Thư mục `server/`**: copy `server/.env.example` ➔ `server/.env` (điền thêm `GEMINI_API_KEY` nếu dùng tính năng AI)
- **Thư mục `client/`**: copy `client/.env.example` ➔ `client/.env`

> Yêu cầu hệ thống: **Node.js** `>= 20`, **npm** `>= 10`, **Docker & Docker Compose**.

---

## 2. Khởi chạy dự án

### Bước 1: Bật hạ tầng dịch vụ (MongoDB, Redis, MinIO)
Mở terminal tại thư mục gốc:
```bash
docker compose -f docker-compose.dev.yml up -d
```

### Bước 2: Chạy Backend
Mở terminal mới:
```bash
cd server
npm install
npm run dev
```
API hoạt động tại: **`http://localhost:4000`**

### Bước 3: Chạy Frontend
Mở terminal mới:
```bash
cd client
npm install
npm run dev
```
Giao diện mở tại: **`http://localhost:5173`**

---

## 3. Tài khoản mặc định

- **Admin**: `admin@abslider.com` / `admin123456` (toàn quyền quản trị hệ thống, cấu hình credit, quản lý user).
- **User**: Tự đăng ký trực tiếp qua trang Đăng ký trên web.

---

## 4. Các lệnh thường dùng

| Vị trí | Lệnh | Chức năng |
|---|---|---|
| **Gốc (`ABSlider/`)** | `docker compose -f docker-compose.dev.yml up -d` | Khởi chạy MongoDB, Redis, MinIO |
| | `docker compose -f docker-compose.dev.yml down` | Dừng dịch vụ hạ tầng |
| **Backend (`server/`)** | `npm run dev` | Chạy dev server (hot-reload) |
| | `npm run build` | Biên dịch TypeScript ra `dist/` |
| | `npm run lint` / `npm test` | Kiểm tra cú pháp / chạy unit test |
| **Frontend (`client/`)** | `npm run dev` | Chạy Vite dev server |
| | `npm run build` | Đóng gói production bundle |
| | `npm run lint` / `npm test` | Kiểm tra cú pháp / chạy test |

---

## 5. Tài liệu chi tiết

Xem thêm các tài liệu trong thư mục [`docs/`](docs/):
- [Cấu trúc dự án](docs/project-structure.md)
- [Quy trình GitHub & CI/CD](docs/github-workflow.md)
- [Quy ước code Frontend](docs/conventions-fe.md)
- [Quy ước code Backend](docs/conventions-be.md)
