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
