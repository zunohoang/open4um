# Backend Conventions — server

## Tổng quan

Tài liệu định nghĩa quy ước code của server. Stack: Node.js + Express v5 + TypeScript + MongoDB (Mongoose) + Redis + Gemini API + MinIO + Jest/Supertest. Kiến trúc phân lớp: `routes → controllers → services → models`.

---

## 1. Quy ước đặt tên file

| Loại | Convention | Ví dụ |
|---|---|---|
| Route | `camelCase.routes.ts` | `lecture.routes.ts` |
| Controller | `camelCase.controller.ts` | `lecture.controller.ts` |
| Service | `camelCase.service.ts` | `lecture.service.ts` |
| Model (Mongoose schema) | `camelCase.model.ts` | `lecture.model.ts` |
| Validator (zod) | `camelCase.validator.ts` | `lecture.validator.ts` |
| Middleware | `camelCase.middleware.ts` | `auth.middleware.ts` |
| Test | cùng tên + `.test.ts` | `lecture.service.test.ts` |

Mỗi resource có đủ bộ file cùng tên gốc: `lecture.routes.ts`, `lecture.controller.ts`, `lecture.service.ts`, `lecture.model.ts`, `lecture.validator.ts`.

---

## 2. Quy ước lớp Route → Controller → Service → Model

```ts
// lecture.routes.ts — chỉ khai báo endpoint + middleware, KHÔNG chứa logic
import { Router } from 'express'
import { requireAuth } from '../middlewares/auth.middleware'
import { validate } from '../middlewares/validate.middleware'
import { createLectureSchema } from './lecture.validator'
import { lectureController } from './lecture.controller'

export const lectureRouter = Router()
lectureRouter.get('/', requireAuth, lectureController.list)
lectureRouter.post('/', requireAuth, validate(createLectureSchema), lectureController.create)
```

```ts
// lecture.controller.ts — nhận request, gọi service, trả response
import { asyncHandler } from '../utils/asyncHandler'
import { lectureService } from './lecture.service'

export const lectureController = {
  list: asyncHandler(async (req, res) => {
    const lectures = await lectureService.listByUser(req.user.id)
    res.json({ success: true, data: lectures })
  }),
  create: asyncHandler(async (req, res) => {
    const lecture = await lectureService.create(req.user.id, req.body)
    res.status(201).json({ success: true, data: lecture })
  }),
}
```

```ts
// lecture.service.ts — business logic, KHÔNG truy vấn DB trực tiếp trong controller
import { LectureModel } from './lecture.model'
import { AppError } from '../utils/AppError'

export const lectureService = {
  listByUser: async (userId: string) => {
    return LectureModel.find({ ownerId: userId, deletedAt: null }).sort({ updatedAt: -1 })
  },
  create: async (userId: string, payload: { title: string }) => {
    if (!payload.title.trim()) throw new AppError('Tên bài giảng không được để trống', 400)
    return LectureModel.create({ ownerId: userId, title: payload.title })
  },
}
```

**Quy tắc:**
- **routes**: chỉ khai báo endpoint + middleware, không có `if/else` nghiệp vụ.
- **controllers**: không chứa business logic hay truy vấn DB trực tiếp — chỉ gọi service và format response.
- **services**: chứa toàn bộ business logic, gọi model/Redis/Gemini API/MinIO; luôn `async`.
- **models**: schema Mongoose + truy vấn dữ liệu thuần, không chứa business rule phức tạp.

---

## 3. Xử lý lỗi & response

```ts
// utils/AppError.ts
export class AppError extends Error {
  constructor(message: string, public statusCode: number = 400) {
    super(message)
  }
}

// middlewares/error.middleware.ts
export const errorMiddleware: ErrorRequestHandler = (err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ success: false, message: err.message })
  }
  logger.error('unhandled error', err)
  res.status(500).json({ success: false, message: 'Đã có lỗi xảy ra, vui lòng thử lại' })
}

// utils/asyncHandler.ts — bọc controller để không lặp try/catch
export const asyncHandler =
  (fn: RequestHandler): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next)
```

**Response envelope thống nhất:**

```json
// Thành công
{ "success": true, "data": { "id": "...", "title": "..." } }

// Lỗi
{ "success": false, "message": "Tên bài giảng không được để trống" }
```

---

## 4. Validation (zod)

```ts
// lecture.validator.ts
import { z } from 'zod'

export const createLectureSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Tên bài giảng không được để trống').max(200),
  }),
})
export type CreateLectureInput = z.infer<typeof createLectureSchema>['body']
```

Validate ngay tại middleware (`validate(schema)`) trước khi vào controller — không validate rải rác trong service.

---

## 5. Auth & phân quyền

```ts
// middlewares/auth.middleware.ts
export const requireAuth: RequestHandler = (req, res, next) => {
  const token = req.headers.authorization?.split('Bearer ')[1]
  if (!token) throw new AppError('Chưa đăng nhập', 401)
  req.user = verifyJwt(token) // { id, role }
  next()
}

export const requireAdmin: RequestHandler = (req, res, next) => {
  if (req.user.role !== 'admin') throw new AppError('Không có quyền truy cập', 403)
  next()
}
```

Dùng `requireAuth` cho mọi route cần đăng nhập, `requireAdmin` cho route Quản trị (UC030-032). Mật khẩu hash bằng bcrypt; JWT ký bằng secret trong env, thời hạn access/refresh token cấu hình qua env.

---

## 6. Cấu hình môi trường

```ts
// config/env.ts — fail-fast nếu thiếu biến bắt buộc
const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  MONGO_URI: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(16),
  GEMINI_API_KEY: z.string(),
  MINIO_ENDPOINT: z.string(),
  MINIO_ACCESS_KEY: z.string(),
  MINIO_SECRET_KEY: z.string(),
})
export const env = envSchema.parse(process.env)
```

| Biến | Mô tả |
|---|---|
| `PORT` | Cổng chạy server Express |
| `MONGO_URI` | Connection string MongoDB |
| `REDIS_URL` | Connection string Redis |
| `JWT_SECRET` | Secret ký JWT |
| `GEMINI_API_KEY` | API key gọi Gemini API |
| `MINIO_ENDPOINT` / `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | Kết nối MinIO lưu media |

Commit `.env.example` (không giá trị thật), **không** commit `.env` hay bất kỳ secret nào.

### Môi trường dev bằng Docker

MongoDB, Redis, MinIO chạy qua **Docker Compose** khi phát triển local — không cài trực tiếp lên máy:

```yaml
# docker-compose.yml (đặt ở thư mục gốc ABSlider/)
services:
  mongo:
    image: mongo:7
    ports: ['27017:27017']
    volumes: ['mongo-data:/data/db']
  redis:
    image: redis:7
    ports: ['6379:6379']
  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    ports: ['9000:9000', '9001:9001']
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    volumes: ['minio-data:/data']

volumes:
  mongo-data:
  minio-data:
```

Chạy `docker compose up -d` trước khi `npm run dev`; `MONGO_URI`/`REDIS_URL`/`MINIO_ENDPOINT` trong `.env` trỏ về `localhost` với port tương ứng.

---

## 7. Logging

```ts
// lib/logger.ts
export const logger = pino({ level: env.NODE_ENV === 'production' ? 'info' : 'debug' })

// dùng trong service
logger.info({ userId, lectureId }, 'lecture.create')
logger.error({ err }, 'gemini.generateOutline failed')
```

Không dùng `console.log` trong code chạy production. Log tối thiểu: request method/path/status/thời gian xử lý, lỗi kèm ngữ cảnh ở mức `error`.

---

## 8. API design

- Prefix version: `/api/v1/...`.
- Danh từ số nhiều cho resource: `/lectures`, `/users`, `/ai-usages`.
- Phân trang thống nhất:

```json
{ "success": true, "data": { "items": [...], "total": 42, "page": 1, "limit": 20 } }
```

---

## 9. Testing

```ts
// lecture.service.test.ts
import { MongoMemoryServer } from 'mongodb-memory-server'

describe('lectureService.create', () => {
  it('ném lỗi khi title rỗng', async () => {
    await expect(lectureService.create('user1', { title: '' })).rejects.toThrow(AppError)
  })
})

// lecture.routes.test.ts (Supertest)
it('GET /api/v1/lectures trả 401 khi chưa đăng nhập', async () => {
  const res = await request(app).get('/api/v1/lectures')
  expect(res.status).toBe(401)
})
```

Jest + Supertest cho integration test (gọi thẳng Express app, không start server thật); MongoDB Memory Server cho test cách ly. Mock Gemini API và MinIO trong test, không gọi dịch vụ thật.

---

## 10. Setup checklist (môi trường dev)

- [ ] Chạy `docker compose up -d` ở thư mục gốc để khởi động MongoDB, Redis, MinIO.
- [ ] Tạo bucket `media` trên MinIO Console (`localhost:9001`), lấy `MINIO_ACCESS_KEY`/`MINIO_SECRET_KEY`.
- [ ] Tạo Gemini API key tại Google AI Studio → `GEMINI_API_KEY`.
- [ ] Copy `.env.example` → `.env`, điền giá trị thật (không commit).
- [ ] Chạy `npm run dev`, kiểm tra `GET /api/v1/health` trả `200`.
