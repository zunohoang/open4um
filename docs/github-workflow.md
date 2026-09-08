# Quy trình làm việc trên GitHub — ABSlider

## Tổng quan

Áp dụng cho cả 2 repo `ABSlider-FE` và `ABSlider-BE`, team 5 người: PM (Hoàng), Tester (Duy), 2 Developer (Nam, Thạch), DevOps (Đức). Mô hình nhánh: **Git Flow**. Commit theo **Conventional Commits**.

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

## 4. GitHub Actions — CI

Mỗi repo có workflow CI riêng tại `.github/workflows/ci.yml`, chạy khi có PR nhắm vào `develop` hoặc `main`.

```yaml
# ABSlider-FE/.github/workflows/ci.yml
name: CI
on:
  pull_request:
    branches: [develop, main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: 'package.json'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npx tsc --noEmit
      - run: npm run test
      - run: npm run build
```

```yaml
# ABSlider-BE/.github/workflows/ci.yml
name: CI
on:
  pull_request:
    branches: [develop, main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: 'package.json'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npx tsc --noEmit
      - run: npm run test   # Jest + Supertest, MongoDB Memory Server tự khởi tạo trong test
      - run: npm run build
```

### Branch protection checklist (`main` và `develop`)

- [ ] Require status check `build-and-test` pass trước khi merge.
- [ ] Require tối thiểu 1 approve review.
- [ ] Require nhánh up-to-date với base trước khi merge.
- [ ] Không cho phép force-push / xóa nhánh `main`, `develop`.

---

## 5. CD

### BE trên VPS (đã chốt)

`ABSlider-BE` deploy lên **VPS** qua Docker + SSH, tự động khi có push vào `main` (production) và có thể mở rộng thêm `develop` → môi trường staging nếu VPS đủ tài nguyên.

```yaml
# ABSlider-BE/.github/workflows/cd.yml
name: CD
on:
  push:
    branches: [main]

jobs:
  deploy:
    needs: build-and-test        # chỉ chạy sau khi job CI pass
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build & push Docker image
        run: |
          docker build -t ${{ secrets.DOCKER_IMAGE }}:${{ github.sha }} .
          docker tag ${{ secrets.DOCKER_IMAGE }}:${{ github.sha }} ${{ secrets.DOCKER_IMAGE }}:latest
          echo "${{ secrets.DOCKER_PASSWORD }}" | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker push ${{ secrets.DOCKER_IMAGE }}:${{ github.sha }}
          docker push ${{ secrets.DOCKER_IMAGE }}:latest
      - name: Deploy qua SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            docker pull ${{ secrets.DOCKER_IMAGE }}:latest
            docker compose -f /opt/abslider/docker-compose.yml up -d --no-deps backend
```

**GitHub repo secrets cần cấu hình** (`Settings → Secrets and variables → Actions`):

| Secret | Mô tả |
|---|---|
| `VPS_HOST` | IP/domain của VPS |
| `VPS_USER` | User SSH deploy (không dùng root) |
| `VPS_SSH_KEY` | Private key SSH (public key đã add vào `~/.ssh/authorized_keys` trên VPS) |
| `DOCKER_IMAGE` | Tên image, VD `ghcr.io/absliderteam/abslider-be` |
| `DOCKER_USERNAME` / `DOCKER_PASSWORD` | Đăng nhập registry chứa image |

Trên VPS, MongoDB/Redis/MinIO chạy cùng qua `docker-compose.yml`; biến môi trường thật (`.env`) đặt sẵn trên VPS tại `/opt/abslider/.env`, **không** đi qua GitHub Actions.

### FE — chưa chốt (việc cần làm sau)

Hạ tầng deploy FE chưa quyết định. Đang nghiêng về **Vercel** (tích hợp Git native, không cần custom GitHub Action — mỗi push lên `main`/`develop` tự deploy preview/production); sẽ cập nhật mục này khi chốt.

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
