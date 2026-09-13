# Nhật ký thay đổi DevOps — ABSlider

Tài liệu này là nguồn theo dõi các thay đổi do DevOps/Codex thực hiện trên repository. Mỗi thay đổi phải được ghi lại trong cùng lượt làm việc và, khi có thể, nằm trong cùng commit với thay đổi tương ứng.

## Quy ước ghi nhận

Mỗi mục phải nêu rõ:

- Ngày thực hiện và nhánh làm việc.
- Mục tiêu và lý do thay đổi.
- File hoặc thành phần bị ảnh hưởng.
- Cách xử lý và quyết định kỹ thuật quan trọng.
- Bằng chứng kiểm tra: lệnh, kết quả PASS/FAIL và lỗi còn tồn tại.
- Trạng thái `Implemented`, `Tested`, `Committed`, `Pushed`, `Deployed` phải được tách biệt.
- Commit SHA, image digest hoặc deployment URL nếu đã có bằng chứng tương ứng.

Không ghi một thay đổi là `Pushed` hoặc `Deployed` nếu mới chỉ hoàn thành trên máy local.

## Trạng thái chuẩn

| Trạng thái | Ý nghĩa |
|---|---|
| `PLANNED` | Mới đề xuất, chưa thay đổi repository |
| `IMPLEMENTED_LOCAL` | Đã thay đổi trên local, chưa xác minh đầy đủ |
| `TEST_PARTIAL` | Chỉ một phần kiểm tra thành công hoặc còn blocker |
| `TEST_PASS` | Toàn bộ gate được xác định cho thay đổi đã thành công |
| `COMMITTED_LOCAL` | Đã có commit local, chưa có bằng chứng push |
| `PUSHED` | Đã xác minh commit tồn tại trên remote |
| `DEPLOYED` | Đã triển khai và live-check trên môi trường đích |
| `ROLLED_BACK` | Đã quay lại phiên bản trước và xác minh hoạt động |

---

## 2026-09-13 — Khóa credential admin mặc định trên production

### Mục tiêu

Ngăn backend production tự tạo tài khoản quản trị bằng email/mật khẩu mặc định và buộc cấu hình sai phải fail-fast trước khi mở kết nối tới hạ tầng.

### Thay đổi

- Đưa toàn bộ cấu hình seed admin vào schema tập trung tại `server/src/config/env.ts`; `seed.ts` không còn đọc trực tiếp `process.env`.
- Chuẩn hóa email admin về chữ thường sau khi trim.
- `NODE_ENV=production` bắt buộc khai báo:
  - `ADMIN_EMAIL`, đồng thời cấm `admin@abslider.com`.
  - `ADMIN_PASSWORD`, đồng thời cấm `admin123456`.
- Mật khẩu admin production phải có ít nhất 12 ký tự và đủ chữ thường, chữ hoa, chữ số, ký tự đặc biệt.
- `ADMIN_NAME` mặc định là `Admin ABSlider`; `ADMIN_CREDIT_BALANCE` phải là số nguyên không âm và mặc định là `1000`.
- Development/test vẫn giữ fallback seed cũ khi email hoặc mật khẩu để trống, nhằm không phá vỡ môi trường local và integration test hiện tại.
- Sửa `.env.example` để không còn phát hành credential mặc định dưới dạng giá trị cấu hình sẵn; bổ sung `ADMIN_CREDIT_BALANCE`.
- Thêm unit test cho credential thiếu, credential mặc định, mật khẩu yếu, cấu hình hợp lệ và fallback development.

Validation được thực thi khi module cấu hình được nạp. Vì `server.ts` import cấu hình trước khi gọi `connectMongo()`, cấu hình production không hợp lệ dừng process trước khi kết nối MongoDB, Redis hoặc MinIO.

### File bị ảnh hưởng

- `server/.env.example`
- `server/src/config/env.ts`
- `server/src/lib/seed.ts`
- `server/tests/unit/config/env.test.ts`

### Bằng chứng kiểm tra

| Kiểm tra | Kết quả | Ghi chú |
|---|---|---|
| Focused environment tests | PASS | 1/1 suite, 5/5 test |
| Backend full tests | PASS | 20/20 suite, 166/166 test |
| Backend lint | PASS | `npm --prefix server run lint` |
| Backend build | PASS | `npm --prefix server run build` |
| Production missing credentials | PASS | Process thoát mã `1`, báo thiếu cả `ADMIN_EMAIL` và `ADMIN_PASSWORD` |
| Fail-fast ordering | PASS | Không có log kết nối MongoDB trước khi process từ chối cấu hình |
| Docker build | PASS | Image local `abslider-server:admin-hardening-gate`, ID `sha256:6e122fddb6fd7e4af7314c9fd8652eef6bea0605a549696dc6a1372cb54b1641` |
| Valid production runtime | PASS | Container non-root báo `healthy`, readiness trả `200` và graceful shutdown exit `0` |
| Admin seed runtime | PASS | Email được chuẩn hóa thành `owner@example.com`; role `admin` và password được lưu dưới dạng hash |
| Temporary resource cleanup | PASS | Không còn container hoặc network `abslider-admin*` sau smoke test |

### Trạng thái

| Mức | Trạng thái |
|---|---|
| Production admin hardening | `TEST_PASS` — local only |
| Commit | `COMMITTED_LOCAL` — `cf9c5af901a66503bf1e01700bc933b1a6b6bb5d` |
| Push | `PUSHED` — local `HEAD` và `origin/developer` cùng trỏ tới `cf9c5af901a66503bf1e01700bc933b1a6b6bb5d` |
| CI/CD | Chưa triển khai |
| Production | Chưa deploy |

---

## 2026-09-13 — Readiness probe và graceful shutdown cho backend

### Mục tiêu

Tách liveness khỏi dependency readiness để Docker/Jenkins có thể nhận biết đúng trạng thái phục vụ của backend, đồng thời đóng HTTP server, cron job, MongoDB và Redis có kiểm soát khi container nhận tín hiệu dừng.

### Thay đổi

- Giữ nguyên `GET /api/v1/health` để tương thích với smoke check hiện có.
- Thêm `GET /api/v1/health/live`:
  - Chỉ chứng minh tiến trình Express còn sống.
  - Không gọi MongoDB, Redis hoặc MinIO.
- Thêm `GET /api/v1/health/ready`:
  - Ping MongoDB và Redis, đồng thời kiểm tra bucket `media` trên MinIO.
  - Trả `200` và `status: ready` khi cả ba dependency đều hoạt động.
  - Trả `503` và `status: not_ready` khi có dependency lỗi hoặc server đang shutdown.
  - Chỉ công bố trạng thái `up/down`, không trả chi tiết exception hoặc thông tin kết nối.
- Thêm timeout cấu hình được cho từng dependency check qua `HEALTH_CHECK_TIMEOUT_MS`, mặc định 3 giây.
- Backend giữ HTTP server handle và đăng ký một lần cho `SIGTERM`, `SIGINT`.
- Khi shutdown:
  - Đánh dấu server là not-ready và chống xử lý tín hiệu lặp.
  - Dừng hai cron job.
  - Chờ HTTP server đóng trong `SHUTDOWN_TIMEOUT_MS`, mặc định 10 giây; ép đóng connection nếu quá hạn.
  - Ngắt MongoDB và Redis; đặt exit code `1` nếu có bước cleanup lỗi.
- Hai hàm khởi tạo cron trả lại task handle để lifecycle có thể dừng lịch chạy.
- Thêm Docker `HEALTHCHECK` gọi readiness bằng Node runtime sẵn có, không cài thêm `curl` hoặc `wget`.
- Bổ sung unit test cho contract route, tổng hợp dependency readiness, trạng thái shutdown, tính idempotent và timeout cưỡng bức đóng HTTP connection.

### File bị ảnh hưởng

- `server/.env.example`
- `server/Dockerfile`
- `server/src/config/env.ts`
- `server/src/cron/index.ts`
- `server/src/cron/lockedUserCleanup.cron.ts`
- `server/src/cron/trashCleanup.cron.ts`
- `server/src/lib/gracefulShutdown.ts`
- `server/src/routes/health.routes.ts`
- `server/src/server.ts`
- `server/src/services/health.service.ts`
- `server/tests/unit/lib/gracefulShutdown.test.ts`
- `server/tests/unit/routes/health.routes.test.ts`
- `server/tests/unit/services/health.service.test.ts`

### Bằng chứng kiểm tra

| Kiểm tra | Kết quả | Ghi chú |
|---|---|---|
| Focused tests | PASS | 3/3 suite, 9/9 test |
| Backend full tests | PASS | 19/19 suite, 161/161 test |
| Backend lint | PASS | `npm --prefix server run lint` |
| Backend build | PASS | `npm --prefix server run build` |
| Docker build | PASS | Image local `abslider-server:readiness-gate`, ID `sha256:fed212b33f4f40f9d27237248c969b719fce2ba1b8666c2d9494af8e7d00e201` |
| Docker health metadata | PASS | Interval 30 giây, timeout 5 giây, start period 30 giây, 3 retries |
| Runtime identity | PASS | Container chạy bằng user `abslider` |
| Runtime readiness | PASS | Docker báo `healthy`; MongoDB, Redis, MinIO đều `up` |
| Endpoint compatibility | PASS | `/api/v1/health`, `/health/live`, `/health/ready` đều trả `200` trong smoke environment khỏe mạnh |
| Dependency failure/recovery | PASS | Dừng Redis làm readiness trả `503` với riêng Redis `down`; khởi động lại Redis làm readiness phục hồi `200` |
| SIGTERM shutdown | PASS | Log có bắt đầu/kết thúc graceful shutdown, container exit code `0` |
| Temporary resource cleanup | PASS | Không còn container hoặc network `abslider-readiness*` sau smoke test |

### Vấn đề còn lại

- Fallback admin `admin@abslider.com` / `admin123456` vẫn còn trong seed; sẽ harden ở bước kế tiếp trước khi dựng Jenkins.
- Image chỉ được build và kiểm tra local, chưa push registry hoặc deploy.

### Trạng thái

| Mức | Trạng thái |
|---|---|
| Readiness và graceful shutdown | `TEST_PASS` — local only |
| Commit | `COMMITTED_LOCAL` — `54f511907d48a27acdf8cceae33686d88bca5593` |
| Push | `PUSHED` — local `HEAD` và `origin/developer` cùng trỏ tới `54f511907d48a27acdf8cceae33686d88bca5593` |
| CI/CD | Chưa triển khai |
| Production | Chưa deploy |

---

## 2026-09-13 — Hardening backend Docker image và sửa MinIO registry

### Mục tiêu

Giảm build context và runtime attack surface của backend image, chạy ứng dụng bằng user không phải `root`, khóa base image theo digest và xác minh container khởi động thật với MongoDB, Redis, MinIO.

### Thay đổi

- Tạo `server/.dockerignore` để loại khỏi build context:
  - `node_modules`, `dist`, `coverage`, `tests`.
  - Toàn bộ `.env`/`.env.*`, log, npm debug log và metadata Git.
- Tái cấu trúc `server/Dockerfile` thành ba stage:
  - `build`: clean install đầy đủ và biên dịch TypeScript.
  - `production-dependencies`: clean install chỉ production dependencies và xóa npm cache.
  - `runtime`: Alpine thuần, chỉ chứa Node binary, CA certificates, `libstdc++`, `dist` và production `node_modules`.
- Khóa Node base image bằng cả tag và manifest digest:
  - `node:24.21.0-alpine3.24@sha256:be80f76cf40ec8e42b9bec49f60a55e0660f30af58d3e5a25530785b30ea67e2`.
- Khóa Alpine runtime image bằng digest:
  - `alpine:3.24@sha256:28bd5fe8b56d1bd048e5babf5b10710ebe0bae67db86916198a6eec434943f8b`.
- Tạo user/group `abslider` cố định UID/GID `10001`, chuyển quyền `dist` và `node_modules`, sau đó đặt `USER abslider`.
- Runtime không chứa npm/yarn và chạy trực tiếp `/usr/local/bin/node dist/server.js`.
- Sửa `docker-compose.dev.yml`:
  - Thay image không pull được `minio/minio:latest` bằng release đã khóa `quay.io/minio/minio:RELEASE.2025-06-13T11-33-47Z`.
  - Digest MinIO đã xác minh: `sha256:064117214caceaa8d8a90ef7caa58f2b2aeb316b5156afe9ee8da5b4d83e12c8`.

Registry `quay.io/minio/minio` và release trên được đối chiếu từ tài liệu container chính thức của MinIO: `https://min.io/docs/minio/container/index.html`.

### Bằng chứng kiểm tra

| Kiểm tra | Kết quả | Ghi chú |
|---|---|---|
| Dockerfile build | PASS | `docker build`; final local image `abslider-server:docker-hardening-gate` |
| Final local image ID | PASS | `sha256:21dd4586cdd8f623d54b2cc41c36d4cd4dbf1bbd35792f6708145d46d3e33c82` |
| Build context archive | PASS | Giảm từ 272,752,640 byte xuống 624,640 byte, khoảng 99.77% |
| Runtime image size | PASS | Giảm từ 75,174,510 byte xuống 60,813,220 byte, khoảng 19.1% |
| Runtime Node | PASS | Node `v24.21.0` |
| Runtime identity | PASS | `abslider`, UID/GID `10001`; Node process PID 1 cũng chạy UID/GID `10001` |
| Runtime package managers | PASS | Không có npm hoặc yarn |
| Native dependency | PASS | `require('bcrypt')` load thành công trong final image |
| Docker Compose config | PASS | `docker compose ... config --quiet` với biến kiểm tra |
| MinIO pinned pull | PASS | Pull từ Quay theo release tag và digest đã ghi nhận |
| Dependency readiness | PASS | MongoDB ping, Redis `PONG`, MinIO live endpoint thành công trên network smoke tạm |
| Backend runtime smoke | PASS | Kết nối MongoDB, Redis, MinIO; migration/seed hoàn tất; `GET /api/v1/health` trả `{"success":true,"data":{"status":"ok"}}` |
| Temporary resource cleanup | PASS | Hai lượt container/network smoke đều dùng container `--rm`; tất cả container và network tạm đã được xóa |
| Whitespace/error markers | PASS | `git diff --check` |

Lần chạy smoke đầu tiên phát hiện `minio/minio:latest` trả `pull access denied`. Đây là lỗi cấu hình Compose thực tế, không phải lỗi backend; đã chuyển sang registry Quay theo hướng dẫn chính thức và smoke test lại thành công.

### Vấn đề chưa xử lý trong bước này

- `/api/v1/health` vẫn là liveness tĩnh, chưa chứng minh dependency readiness; sẽ tách liveness/readiness ở bước tiếp theo.
- `server/src/server.ts` chưa giữ HTTP server handle và chưa graceful shutdown MongoDB/Redis khi nhận `SIGTERM`/`SIGINT`.
- `server/src/lib/seed.ts` còn fallback admin email/password mặc định; chưa an toàn cho production.
- Image mới chỉ tồn tại local, chưa push registry và chưa triển khai.
- Dependency vulnerabilities và Babel peer warnings vẫn cần lượt audit riêng; không chạy `npm audit fix --force`.

### Trạng thái

| Mức | Trạng thái |
|---|---|
| Docker build hardening | `TEST_PASS` |
| Non-root runtime | `TEST_PASS` |
| Runtime smoke với dependency thật | `TEST_PASS` — local only |
| Commit | `COMMITTED_LOCAL` — `c6658118649a070e616011d61782752a6e45f9c4` |
| Push | `PUSHED` — local `HEAD` và `origin/developer` cùng trỏ tới `c6658118649a070e616011d61782752a6e45f9c4` |
| CI/CD | Chưa triển khai |
| Production | Chưa deploy |

---

## 2026-09-13 — Chuẩn hóa Node.js 24 cho repository và backend image

### Mục tiêu

Loại bỏ độ lệch phiên bản Node.js giữa môi trường phát triển, client, server và backend Docker image; tạo một contract phiên bản có thể tái sử dụng cho Jenkins agent sau này.

### Phiên bản chuẩn

| Thành phần | Phiên bản |
|---|---|
| Node.js | `24.21.0` LTS |
| npm | `11.19.0` |
| Alpine Linux trong backend image | `3.24` |
| `@types/node` | Major 24; lockfile hiện resolve `24.13.4` |
| Base image | `node:24.21.0-alpine3.24` |
| Base image digest đã kiểm tra | `sha256:be80f76cf40ec8e42b9bec49f60a55e0660f30af58d3e5a25530785b30ea67e2` |

Node 24 được chọn vì là nhánh LTS còn được hỗ trợ; Node 20 trong Dockerfile cũ đã EOL. Nguồn kiểm tra: `https://nodejs.org/en/about/previous-releases` và Docker Official Image `node`.

### Thay đổi

- Tạo `.nvmrc` với giá trị `24.21.0` để NVM trên workstation và Jenkins agent có một nguồn phiên bản chung.
- `client/package.json` và `server/package.json`:
  - Thêm `packageManager: npm@11.19.0`.
  - Thêm `engines.node: >=24.21.0 <25` và `engines.npm: >=11.19.0 <12`.
  - Nâng `@types/node` từ major 22 lên major 24.
- Tạo lại metadata tương ứng trong `client/package-lock.json` và `server/package-lock.json` bằng npm `11.19.0` chạy trong image Node mục tiêu.
- Chuyển cả build stage và runtime stage của `server/Dockerfile` từ tag động `node:20-alpine` sang `node:24.21.0-alpine3.24`.

### Bằng chứng kiểm tra

| Kiểm tra | Kết quả | Ghi chú |
|---|---|---|
| Official Node image | PASS | `node:24.21.0-alpine3.24` trả Node `v24.21.0`, npm `11.19.0` |
| Workstation NVM install | PASS | Tải Node `v24.21.0`, checksum SHA-256 khớp; npm `11.19.0` |
| Client lockfile update | PASS | Chạy bằng npm `11.19.0`; `@types/node` resolve `24.13.4` |
| Server lockfile update | PASS có cảnh báo | Chạy bằng npm `11.19.0`; còn Babel peer warnings |
| Client clean install | PASS có cảnh báo | 251 package; còn 2 lỗ hổng moderate và cảnh báo install scripts |
| Client lint | PASS | Chạy trong Node `24.21.0` image |
| Client build | PASS có cảnh báo | Vite build thành công; bundle chính khoảng 865.74 kB vượt cảnh báo 500 kB |
| Server clean install | PASS có cảnh báo | 895 package; còn 6 lỗ hổng: 4 moderate, 1 high, 1 critical |
| Server lint | PASS | Chạy trong Node `24.21.0` image |
| Server build | PASS | Chạy trong Node `24.21.0` image |
| Server tests | PASS | Node `24.21.0`, npm `11.19.0`; 16/16 suites và 152/152 tests; 24.152 giây |
| Backend Docker build | PASS | Local image `abslider-server:node24-gate`, image ID `sha256:f290da071ec09ff0748ea1ba1791f1498281568eba4d93f34455bd5ae4d714d2`, khoảng 75.17 MB |
| Backend runtime version | PASS | Container trả Node `v24.21.0`, npm `11.19.0` |
| Temporary test volume cleanup | PASS | Đã xóa `abslider_node24_server_test_20260913` sau khi test |
| Whitespace/error markers | PASS | `git diff --check` |
| Workstation client gate | PASS có cảnh báo | Clean install, lint và build PASS bằng Node `24.21.0`; còn bundle-size warning |
| Workstation server gate | PASS có cảnh báo | Clean install, lint, build PASS; 16/16 suites và 152/152 tests PASS trong 24.657 giây |

Hai lần kiểm tra ban đầu trong container thất bại do harness kiểm tra, không phải source:

- Anonymous `/workspace/node_modules` volume do Docker tạo thuộc `root`, nên UID 1000 không thể chạy `npm ci`. Đã sửa bằng cách chuẩn bị quyền volume trước khi chạy dưới user không phải root.
- Lần chạy Testcontainers đầu tiên dùng `su node`, làm mất supplementary Docker group và báo `Could not find a working container runtime strategy`. Đã chạy lại trực tiếp với UID/GID 1000 và Docker socket group 984; toàn bộ 152 tests PASS.

### Vấn đề chưa xử lý trong bước này

- Không chạy `npm audit fix --force`; các lỗ hổng và Babel peer warnings cần một lượt dependency audit riêng.
- Backend Docker build context khoảng 256 MB vì chưa có `server/.dockerignore`.
- Backend runtime vẫn chạy bằng `root` và vẫn chứa npm; sẽ xử lý trong bước Docker hardening.
- Jenkins agent chưa được tạo nên mới có contract phiên bản, chưa có bằng chứng runtime Jenkins.

### Trạng thái

| Mức | Trạng thái |
|---|---|
| Repository Node/npm contract | `TEST_PASS` |
| Client install/lint/build trên Node mục tiêu | `TEST_PASS` |
| Server install/lint/build/test trên Node mục tiêu | `TEST_PASS` |
| Backend Docker build | `TEST_PASS` — local only |
| Workstation Node/npm | `TEST_PASS` — Node `24.21.0`, npm `11.19.0` |
| Commit | `COMMITTED_LOCAL` — `69fc5c1270e7a42396d07f4d7f3e982de1924c32` |
| Push | `PUSHED` — local `HEAD` và `origin/developer` cùng trỏ tới `69fc5c1270e7a42396d07f4d7f3e982de1924c32` |
| CI/CD | Chưa triển khai |
| Production | Chưa deploy |

---

## 2026-09-13 — Ổn định clean install và integration test backend

### Mục tiêu

Loại bỏ dependency Jest không được sử dụng, sửa lỗi MongoDB Testcontainers không thể khởi động trên kernel Linux hiện tại và bảo đảm Jest tự giải phóng MongoDB/Redis mà không cần `--forceExit`.

### Nguyên nhân đã xác minh

- Jest biến đổi TypeScript bằng `@swc/jest`; repository không có code hoặc cấu hình sử dụng `ts-jest`.
- `ts-jest@29.4.12` yêu cầu TypeScript `<7`, trong khi backend dùng TypeScript `7.0.2`, làm `npm ci` thất bại do peer dependency conflict.
- Integration test dùng image động `mongo:8`. Image này không thể khởi động trên kernel local `7.0.0-31` và báo `Health check failed: unhealthy`.
- Khi setup MongoDB thất bại, `afterEach` vẫn xóa database và `afterAll` gọi `.stop()` trên container chưa được tạo, sinh thêm timeout và `TypeError` không phải lỗi nghiệp vụ.
- Test tự đặt biến môi trường trong `server/tests/setup.ts`; thiếu file `.env` không phải nguyên nhân của lỗi integration test này.

### Thay đổi

- `server/package.json`, `server/package-lock.json`:
  - Gỡ `ts-jest`; tiếp tục dùng `@swc/jest` theo cấu hình hiện có.
  - Bỏ `--forceExit` khỏi script `npm test` sau khi đã xác minh toàn bộ test tự kết thúc bình thường.
- `server/tests/integration/testDb.ts`:
  - Khóa image Testcontainers thành `mongo:8.0.30` thay cho tag động `mongo:8`.
  - Truyền `GLIBC_TUNABLES=glibc.pthread.rseq=1` để MongoDB chạy được trên kernel bị ảnh hưởng.
  - Cho phép biến container ở trạng thái chưa khởi tạo và chỉ dọn database sau khi setup hoàn tất.
  - Chỉ ngắt kết nối/dừng resource đã thực sự được tạo, tránh lỗi dây chuyền khi `beforeAll` thất bại.
  - Tăng timeout setup lên 180 giây cho lần tải image đầu tiên trên CI; timeout cleanup là 60 giây và cleanup giữa test là 30 giây.
- `docker-compose.dev.yml`:
  - Đồng bộ MongoDB sang `mongo:8.0.30` và cùng biến `GLIBC_TUNABLES`.

`GLIBC_TUNABLES` là workaround tương thích cho các máy dùng kernel bị ảnh hưởng. Có thể đánh giá gỡ workaround sau khi toàn bộ máy developer và Jenkins agent dùng kernel đã sửa lỗi.

### Bằng chứng kiểm tra

| Kiểm tra | Kết quả | Ghi chú |
|---|---|---|
| Server clean install | PASS | `npm --prefix server ci`; cài 896 package và không còn peer conflict `ts-jest`/TypeScript |
| Server lint | PASS | `npm --prefix server run lint` |
| Server TypeScript build | PASS | `npm --prefix server run build` |
| Docker Compose config | PASS | Render `docker-compose.dev.yml` bằng biến môi trường kiểm tra và `docker compose ... config --quiet` |
| Whitespace/error markers | PASS | `git diff --check` |
| Gọi Jest từ sai working directory | FAIL do lệnh kiểm tra | `npm --prefix server exec -- jest ...` đứng ở repository root nên không tìm thấy `jest.config.js`; không phải lỗi source |
| Integration tests không `--forceExit` | PASS | 3/3 suites, 38/38 tests; 95.559 giây |
| Toàn bộ server tests qua script chuẩn | PASS | `npm --prefix server test`; 16/16 suites, 152/152 tests; 21.382 giây; Jest tự thoát bình thường |

### Vấn đề chưa xử lý trong bước này

- Các cảnh báo dependency và 6 lỗ hổng từ `npm audit` chưa được tự động sửa; không chạy `npm audit fix --force` vì có thể gây breaking change.
- Gate 0 của toàn dự án chưa hoàn tất: còn chuẩn hóa Node.js, bổ sung frontend typecheck/test, harden Docker image và readiness check trước khi tạo Jenkins pipeline.

### Trạng thái

| Mức | Trạng thái |
|---|---|
| Backend clean install và test gate | `TEST_PASS` |
| Commit | `COMMITTED_LOCAL` — `703b7efec308e846de110b4dd55c4f0f47d16627` |
| Push | `PUSHED` — local `HEAD` và `origin/developer` cùng trỏ tới `703b7efec308e846de110b4dd55c4f0f47d16627` |
| CI/CD | Chưa triển khai |
| Production | Chưa deploy |

---

## 2026-09-13 — Hợp nhất lịch sử `main` vào `developer`

### Mục tiêu

Tạo nhánh làm việc dài hạn `developer` từ `origin/develop`, sau đó hợp nhất lịch sử riêng của `main` để chuẩn bị mô hình hai nhánh `developer` và `main`, không sử dụng staging.

### Phạm vi và quyết định

- Nhánh local `developer` được tạo từ `origin/develop` tại commit `4d60dea`.
- Trước merge, `main` có 4 commit riêng và `develop` có 5 commit riêng.
- Thực hiện merge `origin/main` vào `developer` bằng `--no-ff --no-commit`.
- Có 9 file conflict thuộc luồng đăng ký, OTP và quên/đặt lại mật khẩu.
- Giữ phiên bản `developer` cho các file conflict vì đây là contract hoàn chỉnh hơn: có UI nhập OTP/mật khẩu mới và đủ validator, route, controller, service cùng test cho `/reset-password`.
- Bản `main` chỉ gửi OTP quên mật khẩu nhưng không hoàn tất thao tác đặt lại mật khẩu.
- Cây nội dung sau resolve có hash `b3f0269742e4a163cc8824fe0dad4572db41632e`, giống cây `developer` trước merge. Merge commit chỉ thống nhất lịch sử, không thay đổi nội dung chức năng.

### File conflict đã xử lý

- `client/src/features/auth/api/auth.api.ts`
- `client/src/features/auth/components/AuthPage.tsx`
- `server/src/controllers/auth.controller.ts`
- `server/src/routes/auth.routes.ts`
- `server/src/services/auth.service.ts`
- `server/src/validators/auth.validator.ts`
- `server/tests/integration/auth/auth.test.ts`
- `server/tests/unit/services/auth.service.test.ts`
- `server/tests/unit/validators/auth.validator.test.ts`

### Commit

```text
67a08e870ef6a1ef028a9ef03fc514f181c18c37
chore: reconcile main into developer
```

Parents:

```text
4d60deaa365fc5b6298bfc05905e0be136a6ee2e
74ccef913168259aad9f920c0016f7b96a5730c6
```

### Kết quả kiểm tra

| Kiểm tra | Kết quả | Ghi chú |
|---|---|---|
| Conflict markers | PASS | Không còn `<<<<<<<`, `=======`, `>>>>>>>` |
| Unmerged index entries | PASS | `git ls-files -u` không trả kết quả |
| Client lint | PASS | `npm run lint` |
| Client build | PASS có cảnh báo | Bundle chính khoảng 865.74 kB, vượt ngưỡng cảnh báo 500 kB của Vite |
| Server lint | PASS | `npm run lint` |
| Server build | PASS | `npm run build` |
| Server test | FAIL/BLOCKED | 114 test đã chạy PASS; 3 suite không khởi động vì local `node_modules` thiếu `@testcontainers/mongodb` |
| Server clean install | FAIL/BLOCKED | `ts-jest@29.4.12` yêu cầu TypeScript `<7`, trong khi dự án dùng TypeScript `7.0.2` |

### Blocker tiếp theo

1. Gỡ `ts-jest` nếu xác minh không có code/config sử dụng; Jest hiện transform TypeScript bằng `@swc/jest`.
2. Cập nhật lockfile và chạy lại `npm ci` từ trạng thái sạch.
3. Chạy đủ 16 server test suite với Testcontainers.
4. Chỉ xây Jenkins CI sau khi clean install và test gate ổn định.

### Trạng thái tại thời điểm ghi nhận

| Mức | Trạng thái |
|---|---|
| Conflict resolution | `TEST_PARTIAL` |
| Merge commit | `PUSHED` — `67a08e8` |
| Remote branch `developer` | `PUSHED` — xác minh tại `c46a1a9` |
| CI/CD | Chưa triển khai |
| Production | Chưa deploy |

---

## 2026-09-13 — Thiết lập nhật ký thay đổi DevOps

### Thay đổi

- Tạo `docs/devops-change-log.md`.
- Thêm liên kết tới nhật ký trong `README.md`.
- Áp dụng quy tắc: mọi thay đổi DevOps/Codex sau này phải cập nhật tài liệu này và ghi rõ mức xác minh.

### Trạng thái

`PUSHED` — commit `c46a1a9` đã được xác minh trên `refs/heads/developer`.

---

## 2026-09-13 — Xuất bản nhánh `developer`

### Thay đổi

- Push nhánh local `developer` lên `origin/developer`.
- Đổi upstream của local branch từ `origin/develop` sang `origin/developer`.
- Chưa xóa nhánh cũ `origin/develop`; việc xóa chỉ thực hiện sau khi retarget pull request, cập nhật tài liệu/cấu hình và có xác nhận của nhóm.

### Bằng chứng

```text
local:    c46a1a9c98da6f28ba819d6148f2c1f745f10137
upstream: c46a1a9c98da6f28ba819d6148f2c1f745f10137
remote:   c46a1a9c98da6f28ba819d6148f2c1f745f10137 refs/heads/developer
```

`git status --short --branch`:

```text
## developer...origin/developer
```

### Trạng thái

`PUSHED` — nhánh `developer` và hai commit `67a08e8`, `c46a1a9` đã có trên remote.
