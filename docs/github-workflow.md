# Quy trình làm việc trên GitHub — ABSlider

## Tổng quan

Áp dụng cho repository **ABSlider** trên GitHub (quản lý mã nguồn tập trung cho cả `client` và `server`), team 5 người: PM (Hoàng), Tester (Duy), 2 Developer (Nam, Thạch), DevOps (Đức). Mô hình nhánh: **Git Flow**. Commit theo **Conventional Commits**.

> [!NOTE]
> Toàn bộ dự án `ABSlider` nằm trong **1 repository Git duy nhất**. Jenkins chịu trách nhiệm CI; GitHub Actions chỉ build/publish image sau khi Jenkins PASS đúng commit. Client và server đều chạy bằng Docker Compose trên VPS, phía sau Nginx.


---

## 1. Mô hình nhánh — Git Flow

| Nhánh | Vai trò | Bảo vệ |
|---|---|---|
| `main` | Code production-ready | Protected |
| `develop` | Nhánh tích hợp, luôn build được | Protected |
| `feature/<mã-UC>-<mô-tả>` | 1 tính năng/task, tách từ `develop` | — |
| `release/x.y.z` | Chuẩn bị release, tách từ `develop` | — |
| `hotfix/<mô-tả>` | Sửa lỗi khẩn cấp trên production, tách từ `main` | — |

Ví dụ tên nhánh: `feature/UC008-sinh-slide-ai`, `hotfix/UC002-loi-dang-nhap`.

Luồng merge:
- `feature/*` → PR vào `develop`.
- `release/*` → tách từ `develop` khi chuẩn bị release → merge vào cả `main` và `develop`, gắn tag version trên `main`.
- `hotfix/*` → tách từ `main` → merge vào cả `main` và `develop`.

---

## 2. Commit convention

Theo [Conventional Commits](https://www.conventionalcommits.org/): `<type>(<scope>): <mô tả ngắn>`.

### Types

| Type | Khi nào dùng |
|---|---|
| `feat` | Thêm tính năng mới |
| `fix` | Sửa lỗi |
| `refactor` | Tái cấu trúc code, không đổi hành vi |
| `style` | Format code, không đổi logic |
| `docs` | Cập nhật tài liệu |
| `chore` | Việc vặt (cập nhật dependency, config) |
| `test` | Thêm/sửa test |
| `perf` | Cải thiện hiệu năng |
| `ci` | Thay đổi GitHub Actions workflow |

### Scopes (theo feature module)

| Scope | Phạm vi |
|---|---|
| `auth` | UC001-005 |
| `lecture-generation` | UC006-008 |
| `slide-editor` | UC009-013 |
| `slide-management` | UC014-017 |
| `presentation` | UC018-019 |
| `library` | UC020-028 |
| `export` | UC029 |
| `admin` | UC030-032 |
| `ui` | `components/ui` dùng chung |
| `deps` | Cập nhật thư viện |
| `config` | Cấu hình build/tsconfig/eslint |
| `ci` | Workflow GitHub Actions |

### Ví dụ commit tốt

```
feat(slide-editor): thêm undo/redo cho chỉnh sửa văn bản
fix(auth): sửa lỗi OTP hết hạn không hiển thị thông báo
refactor(library): tách logic tìm kiếm ra useLectureSearch hook
docs(conventions-be): bổ sung ví dụ validate zod
chore(deps): nâng cấp TanStack Query lên v5.60
```

### Quy tắc commit

1. Mô tả ở **thì mệnh lệnh, tiếng Việt**, không viết hoa chữ đầu, không dấu chấm cuối câu.
2. Tham chiếu mã use case (VD: `UC008`) trong scope hoặc mô tả khi commit liên quan trực tiếp 1 UC.
3. Mỗi commit là **1 thay đổi logic hoàn chỉnh** — không gộp nhiều việc không liên quan vào 1 commit.
4. Không commit file build (`dist/`), `node_modules/`, file `.env` thật.

---

## 3. Pull Request

- Mỗi PR gắn với 1 nhánh `feature/*`/`release/*`/`hotfix/*`, không PR thẳng từ nhánh cá nhân rời rạc.
- Dùng `.github/PULL_REQUEST_TEMPLATE.md` gồm: mô tả thay đổi, mã use case/ticket liên quan, checklist (đã test, đã tự review, đã update docs nếu cần).
- Tối thiểu **1 reviewer approve** trước khi merge (team 5 người — ưu tiên dev còn lại review chéo; PM/Tester có thể review phần không kỹ thuật).
- Merge bằng **squash merge** để giữ lịch sử `develop`/`main` gọn; xóa nhánh sau khi merge.
- PR chỉ được merge khi toàn bộ CI check (mục 4) pass.

---

## 4. Jenkins — CI bắt buộc

Jenkins Multibranch Pipeline đọc `Jenkinsfile` tại root repository và là nguồn CI duy nhất. Pipeline áp dụng cho `develop`, `main` và pull request hướng vào hai nhánh này.

Luồng CI hiện tại:

1. GitHub Branch Source index branch/PR bằng GitHub App `github-app-abslider-ci`.
2. Jenkins checkout revision cần kiểm tra trên agent `abslider-agent-01`.
3. Pipeline xác minh branch/PR context, identity agent và Node.js/npm contract.
4. Client/server chạy clean install song song.
5. Client lint/build và server lint/build chạy song song.
6. Backend unit test xuất JUnit và coverage artifact.
7. Jenkins publish commit status có context bắt đầu bằng `continuous-integration/jenkins/` về đúng SHA trên GitHub.

Controller chỉ listen trên loopback nên chưa nhận webhook từ Internet. Multibranch Pipeline dùng `Periodically if not otherwise run` mỗi 15 phút làm trigger dự phòng; có thể scan thủ công khi cần phản hồi ngay.

### Branch protection checklist (`main` và `develop`)

- [ ] Require Jenkins status check pass trước khi merge (`continuous-integration/jenkins/pr-merge` cho PR).
- [ ] Require tối thiểu 1 approve review.
- [ ] Require nhánh up-to-date với base trước khi merge.
- [ ] Không cho phép force-push / xóa nhánh `main`, `develop`.

---

## 5. GitHub Actions — image publishing và CD

Trách nhiệm được tách rõ để Jenkins không cần quyền Docker, registry hoặc production secret:

| Thành phần | Trách nhiệm |
|---|---|
| Jenkins | CI client/server và publish commit status |
| GitHub Actions | Chờ Jenkins PASS đúng SHA, build và publish image GHCR |
| VPS | Chạy hai Compose project tách biệt: Development và Production |

Workflow `.github/workflows/publish-images.yml` chạy khi push vào `develop` hoặc `main` và có thể chạy thủ công trên đúng hai nhánh này. Workflow chỉ tiếp tục khi status Jenkins mới nhất của chính `github.sha` là `success`; trạng thái `failure`/`error` làm workflow dừng, còn `missing`/`pending` được chờ tối đa 25 phút.

### 5.1. Artifact contract

- Client: `ghcr.io/zunohoang/open4um-client:<commit-sha>`.
- Server: `ghcr.io/zunohoang/open4um-server:<commit-sha>`.
- Tag `develop`/`main` chỉ là con trỏ thuận tiện. Compose/deploy bắt buộc dùng reference theo digest `image@sha256:...` được registry trả về.
- Client của `develop` compile API URL `https://dev-slides-api.sbltcup.dev/api/v1`; client của `main` compile `https://slides-api.sbltcup.dev/api/v1`.
- Workflow dùng `GITHUB_TOKEN` với quyền tối thiểu `contents: read`, `statuses: read`, `packages: write`; không cần PAT hoặc SSH key trong giai đoạn publish image.
- Workflow chỉ chạy trên push/dispatch của nhánh tin cậy, không publish package từ pull request.

GitHub Actions hiện **chưa deploy VPS**. Sau lần publish đầu tiên phải xác minh package liên kết đúng repository, visibility phù hợp và có thể pull manifest theo digest trước khi cấp deploy credential.

### 5.2. Luồng CD mục tiêu

```text
PR/push -> Jenkins CI -> GitHub commit status

develop + Jenkins PASS
  -> GitHub Actions build/push image theo SHA
  -> deploy Development
  -> readiness/smoke check

main + Jenkins PASS
  -> build/push Production image
  -> manual approval
  -> deploy Production
  -> readiness/smoke check
  -> rollback digest trước nếu lỗi
```

Phần SSH/deploy chỉ được thêm sau khi deploy wrapper, secret file riêng cho từng môi trường, GitHub Environment và rollback manifest đã sẵn sàng. Runtime secret vẫn đặt ngoài repository tại VPS; không truyền toàn bộ `.env` qua workflow.


---

## 6. `.gitignore` — các mục quan trọng

```gitignore
# chung
node_modules/
.env
*.log

# FE (Vite)
dist/
.vite/

# BE
build/
coverage/
```

---

## 7. Quy trình push lên remote

```bash
git checkout develop
git pull origin develop
git checkout -b feature/UC008-sinh-slide-ai

# ... code ...

git add .
git commit -m "feat(lecture-generation): gọi Gemini API sinh slide từ outline"
git push -u origin feature/UC008-sinh-slide-ai
# → mở PR trên GitHub nhắm vào develop
```

---

## 8. Quy trình xử lý conflict (team 5 người)

Vì nhiều thành viên cùng làm việc trên `develop`, luôn cập nhật nhánh trước khi push để hạn chế conflict:

```bash
git checkout feature/UC008-sinh-slide-ai
git fetch origin
git rebase origin/develop      # hoặc: git merge origin/develop

# Nếu có conflict:
# 1. Mở file conflict, xử lý thủ công (giữ đúng phần logic của cả 2 bên)
git add <file-đã-xử-lý>
git rebase --continue
git push --force-with-lease origin feature/UC008-sinh-slide-ai
```

- Ưu tiên **rebase** trên nhánh `feature/*` cá nhân để lịch sử gọn; **không rebase** nhánh `develop`/`main` dùng chung.
- Conflict phát sinh trong lúc review PR (do `develop` có commit mới) phải được xử lý **trước khi merge**, không merge khi PR còn hiển thị "This branch has conflicts".
- Nếu conflict phức tạp liên quan logic của người khác, trao đổi trực tiếp với người đó trước khi tự ý resolve.

---

## 9. Tagging Releases

```bash
git checkout develop
git checkout -b release/1.2.0
# ... cập nhật version, changelog, test cuối cùng ...
git checkout main
git merge --no-ff release/1.2.0
git tag -a v1.2.0 -m "Release 1.2.0: thêm export PDF, sửa lỗi Undo/Redo"
git push origin main --tags

git checkout develop
git merge --no-ff release/1.2.0
git push origin develop
git branch -d release/1.2.0
```

---

## 10. Quick Reference

```bash
# Tạo nhánh feature mới từ develop
git checkout develop && git pull && git checkout -b feature/<UC>-<mo-ta>

# Cập nhật nhánh feature với develop mới nhất
git fetch origin && git rebase origin/develop

# Đẩy nhánh lên remote lần đầu
git push -u origin <ten-nhanh>

# Xóa nhánh local sau khi PR đã merge
git branch -d feature/<UC>-<mo-ta>

# Xem trạng thái các nhánh remote đã merge
git branch -r --merged develop
```
