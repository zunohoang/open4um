# Quy trình làm việc trên GitHub — ABSlider

## Tổng quan

Áp dụng cho repository **ABSlider** trên GitHub (quản lý mã nguồn tập trung cho cả `client` và `server`), team 5 người: PM (Hoàng), Tester (Duy), 2 Developer (Nam, Thạch), DevOps (Đức). Mô hình nhánh: **Git Flow**. Commit theo **Conventional Commits**.

> [!NOTE]
> Toàn bộ dự án `ABSlider` nằm trong **1 repository Git duy nhất**. Jenkins là hệ thống CI/CD duy nhất; GitHub lưu source code và nhận commit status từ Jenkins, còn Docker Hub lưu container image. Client và server chạy bằng Docker Compose trên VPS, phía sau Nginx.


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
| `ci` | Thay đổi Jenkins pipeline hoặc hạ tầng CI/CD |

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
| `ci` | Jenkins pipeline và CI/CD configuration |

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

Jenkins controller và agent chạy 24/7 trên VPS dưới hai system user tách biệt. Jetty chỉ listen tại `127.0.0.1:8080`; Nginx công bố giao diện qua `https://ci.sbltcup.dev/`, còn UFW không cho Internet truy cập trực tiếp port `8080`. Controller, agent và Nginx đều được systemd tự khởi động cùng host và đã vượt qua reboot/runtime gate.

GitHub webhook chưa được cấu hình. Multibranch Pipeline dùng `Periodically if not otherwise run` với interval 15 phút; sau lần reboot VPS, một scan có cause `Started by timer` đã tự chạy và kết thúc `SUCCESS`. Có thể scan thủ công khi cần phản hồi ngay.

Jenkins dùng user database nội bộ, tắt public signup và Global Matrix Authorization. `anonymous`/`authenticated` không được cấp quyền; tài khoản vận hành hiện có `Overall/Administer`. Nhóm đã chọn dùng chung tài khoản quản trị này, nên chấp nhận mất audit trail theo từng người và mở rộng blast radius nếu credential bị lộ. Không ghi hoặc truyền Jenkins password qua repository.

### Branch protection checklist (`main` và `develop`)

- [ ] Require Jenkins status check pass trước khi merge (`continuous-integration/jenkins/pr-merge` cho PR).
- [ ] Require tối thiểu 1 approve review.
- [ ] Require nhánh up-to-date với base trước khi merge.
- [ ] Không cho phép force-push / xóa nhánh `main`, `develop`.

---

## 5. Jenkins — build image, publish và deploy

Kiến trúc đích không dùng GitHub Actions. GitHub chỉ còn vai trò lưu source code; Docker Hub giữ container image public. Jenkins được tách thành hai vùng tin cậy để credential phát hành không xuất hiện trong job pull request:

| Thành phần | Agent/quyền | Trách nhiệm |
|---|---|---|
| `abslider-ci` | `jenkins-agent`, không Docker/registry/deploy secret | CI cho PR, `develop`, `main`; publish commit status |
| `abslider-release` | `jenkins-builder`, rootless Docker, một executor | Chỉ discover trực tiếp `develop`/`main`; chạy lại quality gate, build và push image |
| `abslider-deploy-01` | `abslider-deploy`, rootless Docker, một executor | Chỉ nhận release manifest; chạy root-owned wrapper, readiness và rollback |

Hai node đặc quyền theo chức năng phải cài Jenkins Job Restrictions Plugin và đặt node-level regex chỉ nhận job cùng task con của hai branch release: `^abslider-release/(develop|main)(/.*)?$`. Phần `(/.*)?` cần cho Pipeline `node` task nội bộ mà plugin biểu diễn bên dưới tên job; nó không mở quyền cho branch hoặc job khác. Label `docker-builder`/`abslider-deploy` một mình không phải ranh giới bảo mật vì Jenkinsfile của PR có thể tự yêu cầu label; node restriction mới ngăn job `abslider-ci/PR-*` chạy trên hai identity này.

`Jenkinsfile.release` là Pipeline-as-Code của release job. Release pipeline từ chối PR, từ chối branch ngoài `develop/main`, xác minh checkout đúng remote head và yêu cầu builder đáp ứng các điều kiện sau:

- Chạy bằng user riêng `jenkins-builder`.
- Docker daemon ở rootless mode; user không ghi được `/var/run/docker.sock`.
- Không đọc được Jenkins controller secrets.
- Node.js `24.21.0`, npm `11.19.0`, Docker Buildx và Compose khả dụng.
- Credential `dockerhub-abslider-publisher` chỉ nằm trong scope của release folder/job, không nằm trong scope của `abslider-ci`.

Release pipeline chạy lại clean install, lint, build và backend unit test trước khi build image. Việc chạy lại gate có chủ ý: chính job được cấp registry/deploy privilege phải tự chứng minh source đang phát hành đạt gate, không phụ thuộc race giữa hai job.

### 5.1. Artifact contract

- Client: `docker.io/ducchert87/open4um-client:<commit-sha>`.
- Server: `docker.io/ducchert87/open4um-server:<commit-sha>`.
- Tag `develop`/`main` chỉ là con trỏ thuận tiện. Compose/deploy bắt buộc dùng reference theo digest `image@sha256:...` được registry trả về.
- Client của `develop` compile API URL `https://dev-slides-api.sbltcup.dev/api/v1`; client của `main` compile `https://slides-api.sbltcup.dev/api/v1`.
- Jenkins đăng nhập Docker Hub bằng credential `dockerhub-abslider-publisher`. Credential chứa Docker Hub username `ducchert87` và access token `Read & Write` có thời hạn; không dùng password tài khoản, không ghi token vào repository/log và không cấp credential này cho Multibranch Pipeline chạy PR.
- Release job chỉ discover nhánh trực tiếp `develop`, `main`; tuyệt đối không discover pull request.

`deploy/bin/deploy-abslider` là source của wrapper triển khai. Bản vận hành phải được admin cài thành `/opt/abslider/bin/deploy-abslider`, owner `root:root`, không cho agent sửa. Wrapper chạy không đặc quyền bằng `abslider-deploy`, chỉ nhận đúng environment, commit SHA và hai digest thuộc namespace ABSlider; dùng secret env file ngoài repository, chạy Compose rootless với `--wait`, kiểm tra backend readiness/frontend health và tự quay lại manifest trước nếu candidate lỗi. Jenkins không nhận `sudo` hoặc quyền vào host Docker socket.

### 5.2. Luồng CD mục tiêu

```text
PR -> Jenkins CI -> GitHub commit status

develop -> Jenkins release quality gate
  -> rootless build/push image theo SHA
  -> deploy Development
  -> readiness/smoke check

main -> Jenkins release quality gate
  -> rootless build/push Production image
  -> manual approval
  -> deploy Production
  -> readiness/smoke check
  -> rollback digest trước nếu lỗi
```

### 5.3. Jenkins-only CI/CD

GitHub Actions đã được loại khỏi repository sau khi Jenkins có runtime proof cho build, test, Docker Hub publish theo immutable digest, manual approval và Production deploy. Contract hiện tại:

1. `Jenkinsfile` xử lý CI và trả commit status về GitHub.
2. `Jenkinsfile.release` chỉ nhận build trực tiếp từ `develop`/`main`.
3. Jenkins builder rootless build và publish image lên Docker Hub theo SHA/digest.
4. `develop` tự động deploy các digest vừa publish lên Development sau khi tất cả release gate PASS.
5. `main` chỉ deploy Production khi `DEPLOY_ENABLED=true` và người được phép xác nhận bước `Approve Production`.
6. Deploy agent rootless triển khai đúng immutable digest.
7. Không thêm file vào `.github/workflows/`; mọi thay đổi CI/CD phải thực hiện trong Jenkins pipeline được review.

Runtime secret luôn nằm ngoài repository và không được truyền qua Pipeline.


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
