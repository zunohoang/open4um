# Kế hoạch triển khai Continuous Delivery cho ABSlider

> Trạng thái: `DRAFT — chưa được phép deploy Production`
>
> Ngày lập kế hoạch: `2026-09-20`
> Task: `KAN-51 — Cấu hình setup CD vào source`

## 1. Mục tiêu

Thiết lập quy trình Continuous Delivery bằng Jenkins và Docker cho ABSlider:

- Pull request tiếp tục chạy Jenkins CI.
- Nhánh `develop` tự động build, publish image và deploy Development.
- Nhánh `main` tự động build/publish nhưng phải được người có quyền duyệt trước khi deploy Production.
- Client/server được triển khai bằng image reference theo digest bất biến.
- Sau deploy phải chạy readiness và public smoke test.
- Candidate lỗi phải tự quay lại image digest trước đó.
- Production phải có backup và restore rehearsal trước khi kích hoạt CD.

CD phiên bản đầu dùng Docker Compose recreate và chấp nhận downtime ngắn. Blue-green, canary và zero-downtime deployment không thuộc phạm vi phiên bản đầu.

## 2. Quy ước trạng thái

| Trạng thái | Ý nghĩa |
|---|---|
| `NOT_STARTED` | Chưa bắt đầu |
| `IN_PROGRESS` | Đang thực hiện |
| `BLOCKED` | Có blocker cần xử lý |
| `IMPLEMENTED_LOCAL` | Đã sửa source local, chưa có runtime proof |
| `TEST_PASS` | Kiểm thử tương ứng đã PASS |
| `DEPLOYED_DEVELOPMENT` | Đã deploy và xác minh Development |
| `AWAITING_APPROVAL` | Đang chờ phê duyệt Production |
| `DEPLOYED_PRODUCTION` | Đã deploy và xác minh Production |
| `ROLLBACK_VERIFIED` | Đã diễn tập rollback thực tế thành công |

Không sử dụng `DONE` nếu mới chỉ hoàn thành source hoặc kiểm tra local.

## 3. Baseline tại thời điểm lập kế hoạch

### 3.1. Git

| Mục | Giá trị snapshot |
|---|---|
| Local branch | `develop` |
| Local HEAD | `7156c0b5c33b34bd36990f7ff8e78febc4ed7925` |
| Remote `develop` | `b31088621c55c45e3c66111a93a9f28e88689102` |
| Remote `main` | `74ccef913168259aad9f920c0016f7b96a5730c6` |
| Dirty file cần bảo toàn | `docs/devops-change-log.md` |

Các SHA trên chỉ là snapshot ngày lập kế hoạch. Trước khi triển khai phải fetch và xác minh lại remote head. Không deploy từ local HEAD hiện tại và không dùng `git reset --hard`/`git checkout --` làm mất thay đổi tài liệu.

### 3.2. Thành phần đã có

- `Jenkinsfile`: CI cho `develop`, `main` và pull request.
- `Jenkinsfile.release`: quality gate, build image, publish Docker Hub, tạo release manifest, approval và deploy stage.
- `client/Dockerfile` và `server/Dockerfile`: image production chạy non-root, có healthcheck.
- `deploy/compose.yml`: runtime contract dùng chung cho Development/Production.
- `deploy/bin/deploy-abslider`: deploy theo digest, readiness check và rollback cơ bản.
- Docker Hub repositories:
  - `docker.io/ducchert87/open4um-client`
  - `docker.io/ducchert87/open4um-server`
- Jenkins release build đã publish image theo SHA/digest thành công.

### 3.3. Phần còn thiếu

| Hạng mục | Trạng thái ban đầu |
|---|---|
| Đồng bộ local với remote `develop` | `NOT_STARTED` |
| Re-audit source mới nhất | `NOT_STARTED` |
| Audit capacity/port VPS | `NOT_STARTED` |
| Jenkins deploy agent | `NOT_STARTED` |
| Development secret env | `NOT_STARTED` |
| Production secret env | `NOT_STARTED` |
| Development DNS/Nginx/TLS | `NOT_STARTED` |
| Production DNS/Nginx/TLS | `NOT_STARTED` |
| Public deployment provenance | `NOT_STARTED` |
| Public smoke-test script | `NOT_STARTED` |
| Development live deployment | `NOT_STARTED` |
| Rollback drill | `NOT_STARTED` |
| Production backup/restore rehearsal | `NOT_STARTED` |
| Production approval/deploy | `NOT_STARTED` |
| Kiwi TCMS integration | `NOT_STARTED` |
| Gỡ GitHub Actions cũ | `IMPLEMENTED` |

## 4. Kiến trúc mục tiêu

```text
Pull Request
  -> Jenkins CI
  -> npm ci
  -> lint
  -> build
  -> unit test
  -> GitHub commit status

develop
  -> Jenkins Release quality gates
  -> build client/server image
  -> push Docker Hub theo commit SHA
  -> lấy immutable digest
  -> deploy Development tự động
  -> internal readiness
  -> public smoke test
  -> rollback image trước nếu lỗi

main
  -> Jenkins Release quality gates
  -> build/push immutable images
  -> backup Production
  -> manual approval
  -> deploy Production
  -> internal readiness
  -> public smoke test
  -> rollback image trước nếu lỗi
```

## 5. Quy hoạch môi trường

Domain Development là đề xuất và phải được PM xác nhận trước khi tạo DNS.

| Thành phần | Development | Production |
|---|---|---|
| Compose project | `abslider-develop` | `abslider-production` |
| Frontend | `dev-slides.sbltcup.dev` | `slides.sbltcup.dev` |
| API | `dev-slides-api.sbltcup.dev` | `slides-api.sbltcup.dev` |
| MinIO media | `dev-slides-media.sbltcup.dev` | `slides-media.sbltcup.dev` |
| Frontend host port | `127.0.0.1:4200` | `127.0.0.1:4100` |
| Backend host port | `127.0.0.1:4201` | `127.0.0.1:4101` |
| MinIO host port | `127.0.0.1:4202` | `127.0.0.1:4102` |
| Runtime env | `/opt/abslider/shared/develop.env` | `/opt/abslider/shared/production.env` |
| Deploy policy | Tự động | Manual approval |
| Volumes/secrets | Riêng | Riêng |

MongoDB, Redis và MinIO console không được publish ra Internet.

## 6. Phase 0 — Đồng bộ và khóa baseline

### Công việc

- [x] Sao lưu các tài liệu chưa commit ra thư mục backup bên ngoài repository.
- [x] Fetch remote và xác minh lại SHA của `develop`/`main`.
- [x] Tạo branch task từ đúng `origin/develop` mới nhất.
- [x] Re-apply thay đổi tài liệu, không ghi đè dirty worktree cũ.
- [x] So sánh thay đổi từ local HEAD cũ tới remote head mới.
- [x] Chạy lại client clean install, lint và build.
- [x] Chạy lại server clean install, lint, build và unit test.
- [x] Build lại client/server Docker image.
- [x] Render `deploy/compose.yml` bằng giá trị kiểm tra.
- [x] Ghi lại `BASE_SHA`, Dockerfile hash, Jenkinsfile hash, wrapper hash và Compose hash.

### Acceptance criteria

- [x] Không mất thay đổi có sẵn của người dùng.
- [x] Task branch dựa trên đúng remote `develop`.
- [x] Quality gates hiện tại PASS.
- [x] Không phát hiện secret dạng rõ ràng trong phần tài liệu thay đổi.

### Bằng chứng Phase 0 — 2026-09-20

| Hạng mục | Kết quả |
|---|---|
| Branch triển khai | `feature/KAN-51-setup-cd` |
| Base SHA | `b31088621c55c45e3c66111a93a9f28e88689102` |
| Remote `main` | `74ccef913168259aad9f920c0016f7b96a5730c6` |
| Backup tài liệu | `/home/duckcy/work/.open4um-phase0-backup-20260920` |
| Client | `npm ci`, lint và build PASS |
| Server | `npm ci`, lint, build và `21/21` suite, `190/190` test PASS |
| Client image local | `abslider-client:phase0-b310886`, `amd64`, user `nginx`, healthcheck tồn tại |
| Server image local | `abslider-server:phase0-b310886`, `amd64`, user `abslider`, healthcheck tồn tại |
| Compose | `docker compose config --quiet` PASS bằng placeholder không phải secret thật |
| Deploy wrapper | `bash -n deploy/bin/deploy-abslider` PASS |
| `client/Dockerfile` | `c12e0cd9adfe9580bb9af432cdb30496528e5015a49d66e466ff9c223098689f` |
| `server/Dockerfile` | `aa86c2b13626ac35a83b4d1af845c51aa6ee3a63c6feb1432958170678763613` |
| `Jenkinsfile` | `9714a9343218d2da6d9877557750726ae812dcce6ce1e0ee41196a7b1596cf45` |
| `Jenkinsfile.release` | `8812786b539163bbfebeba8838fac001013459293d3a225f3edb21e7eda203c0` |
| Deploy wrapper | `bb82543997c7ef979506dcdb9ae721398ca53d797ed952c8ee7f5920b0337905` |
| Compose | `97dd1372fbb5820707b1e07dd66b2d113d33405c66365563a7f23decc2a20fd5` |

Các cảnh báo chưa chặn Phase 0:

- Client có `2` dependency vulnerability mức moderate; server có `4`. Chưa chạy `npm audit fix --force` vì có nguy cơ breaking change.
- Client build PASS nhưng chunk JavaScript lớn nhất khoảng `949.83 kB`, vượt cảnh báo `500 kB`; cần tạo task tối ưu bundle riêng nếu ảnh hưởng hiệu năng.

## 7. Phase 1 — Audit VPS và capacity gate

VPS đang chạy chung Jenkins, Kiwi TCMS, Nginx và workload khác. Không được giả định capacity cũ vẫn đúng.

### Kiểm tra chỉ đọc

- [x] RAM, swap, disk và inode.
- [x] CPU/load và process hiện tại.
- [x] Rootful/rootless Docker storage.
- [x] Container, volume và network hiện có.
- [x] Port/listener hiện có.
- [x] Nginx virtual hosts và TLS certificates.
- [x] UFW/firewall.
- [x] Jenkins controller, builder và agent.
- [x] User/service `abslider-deploy` và rootless Docker; kết quả `BLOCKED`, chưa có linger/user service.
- [x] Kiwi TCMS vẫn healthy.
- [x] DNS của các domain dự kiến.

### Capacity cần tính

Mỗi môi trường ABSlider cần:

```text
mongo + redis + minio + server + client
```

Nếu VPS không đủ cho cả Development và Production thì phải ưu tiên Development hoặc chuyển Production sang VPS riêng. Không lấy swap cao làm bằng chứng VPS đủ tài nguyên.

### Acceptance criteria

- [x] Không xung đột port.
- [ ] Có đủ disk cho image, volumes và backups.
- [ ] Jenkins/Kiwi không bị ảnh hưởng.
- [ ] Có quyết định rõ ràng: cùng VPS hay Production VPS riêng.

### Bằng chứng audit Phase 1 — 2026-09-20

| Hạng mục | Kết quả |
|---|---|
| VPS | `life-os-prod-01`, Ubuntu 24.04, x86_64, 2 vCPU |
| RAM | 3.8 GiB total, khoảng 2.1 GiB available tại thời điểm kiểm tra |
| Swap | 2.0 GiB total, khoảng 588 MiB đang dùng |
| Disk | 38 GiB total, 18 GiB available, 53% đang dùng |
| Inode | 13% đang dùng |
| Docker rootful | Docker 29.7.2, Compose 5.4.0, 8.666 GB images |
| Docker rootless builder | Socket `/run/user/995/docker.sock`; root `/var/lib/jenkins-builder/.local/share/docker`; security có `rootless` |
| Container đang chạy | `kiwitcms-web-1` và `kiwitcms-db-1` đều healthy |
| Jenkins | Controller, `abslider-agent-01` và `abslider-builder-01` đều có process đang chạy |
| Runtime account | `abslider-deploy` UID/GID riêng, shell `nologin`; linger đã bật, runtime path `/run/user/999` |
| Rootless prerequisites | `dockerd-rootless-setuptool.sh`, `rootlesskit`, `slirp4netns`, `newuidmap`, `newgidmap` đều có; unprivileged user namespace được bật |
| Account isolation | `abslider-deploy` chỉ thuộc group riêng, không thuộc group `docker`; home riêng writable |
| Subordinate IDs | `PASS`: `/etc/subuid` và `/etc/subgid` đều có `abslider-deploy:296608:65536` |
| Dải subordinate | `296608-362143` (`65536` IDs), không trùng các dải hiện hữu |
| Rootless tool suggestion | Không dùng đề xuất `100000:65536` vì trùng hoàn toàn với dải của `deploy` |
| Backup subordinate config | `/etc/subuid.before-abslider-20260921T023458Z` và `/etc/subgid.before-abslider-20260921T023458Z` |
| Rootless deploy daemon | Docker 29.7.2, Compose 5.4.0; service enabled/active, socket `/run/user/999/docker.sock`, data root `/var/lib/abslider-deploy/.local/share/docker` |
| Rootless deploy containers | Không có container tại thời điểm cài đặt |
| Runtime path | `/opt/abslider` đã tồn tại; `releases` và `shared` thuộc contract `abslider-deploy` |
| Candidate ports | `4100-4102` và `4200-4202` đều trống |
| Nginx | `nginx -t` PASS; hiện phục vụ `api`, `staging-api`, `ci` và `kiwitcms.sbltcup.dev` |
| TLS | Certbot có 4 certificate hợp lệ cho các site hiện hữu; chưa có certificate ABSlider Development/Production |
| Firewall | UFW `inactive`; cần xác minh provider firewall trước khi công bố thêm endpoint |
| DNS dự kiến | Cả 6 hostname Development/Production chưa có A/AAAA record |
| Quyền audit | SSH key PASS; `deploy` thuộc group `docker`; `sudo -n` không được phép |

Kết luận capacity tạm thời:

- Development có thể tiếp tục chuẩn bị nhưng phải đặt resource limit và theo dõi memory/swap khi chạy thử.
- Chưa phê duyệt chạy đồng thời Development và Production trên VPS 4 GiB này.
- Khuyến nghị dùng VPS Production riêng hoặc tăng RAM trước Production gate.
- Rootless Docker service riêng của `abslider-deploy` đã sẵn sàng; vẫn phải giữ account ngoài host group `docker` và không dùng system Docker socket.

## 8. Phase 2 — Hoàn thiện source CD

### 8.1. `Jenkinsfile.release`

- [x] Đổi top-level agent thành `agent none`.
- [x] Dùng riêng `jenkins-builder` cho quality/build/publish stages.
- [x] Approval không giữ builder executor.
- [x] Không dùng `abortPrevious: true` cho release deployment.
- [x] Đặt timeout riêng cho build, approval và deploy.
- [x] Giữ `DEPLOY_ENABLED=false` trong bootstrap.
- [ ] Sau Development gate, chuyển `develop` sang auto-deploy.
- [x] `main` luôn cần approval trước Production.
- [ ] Giới hạn approver bằng Jenkins user/group.
- [x] Ghi người duyệt vào `APPROVED_BY`.
- [x] Archive/fingerprint release manifest.
- [x] Dọn Docker login config/workspace trong `post`.
- [x] Không đưa runtime secret vào manifest, stash hoặc log.

Release manifest cần chứa:

```text
RELEASE_ENVIRONMENT
RELEASE_SHA
ABSLIDER_CLIENT_IMAGE
ABSLIDER_SERVER_IMAGE
BUILD_NUMBER
BUILD_URL
CREATED_AT
```

### 8.2. Deployment provenance

- [x] Thêm `RELEASE_SHA` và `RELEASE_ENVIRONMENT` vào backend runtime contract.
- [x] Backend health/version endpoint trả đúng SHA/environment không chứa secret.
- [x] Frontend có `/version.json` hoặc metadata tương đương.
- [x] Compose truyền release metadata vào runtime.
- [x] Smoke test so sánh public SHA với release manifest.

### 8.3. `deploy/bin/deploy-abslider`

- [x] Lấy deploy lock trước khi tạo candidate state.
- [x] Kiểm tra owner/mode của wrapper, Compose và secret env.
- [x] Kiểm tra disk trước khi pull.
- [x] Pull đúng image digest.
- [x] Xác minh image sau pull khớp digest dự kiến.
- [x] Lưu candidate/previous manifest và timestamp.
- [x] Chạy `docker compose config --quiet`.
- [x] Chạy `docker compose up --detach --wait`.
- [x] Chạy backend readiness, frontend health và MinIO live check.
- [x] Chạy public smoke check.
- [x] Chỉ cập nhật `current` sau khi toàn bộ gate PASS.
- [x] Rollback về previous digest khi candidate lỗi.
- [x] Sau rollback phải kiểm tra lại readiness/public smoke.
- [x] Phân biệt `ROLLBACK_SUCCEEDED` và `ROLLBACK_FAILED`.
- [x] Giữ current và tối thiểu hai previous release manifests.
- [x] Không dùng broad Docker prune trong deployment.

### 8.4. Public smoke script

Tạo `deploy/bin/smoke-abslider` để kiểm tra:

- [x] Frontend HTTPS `200`.
- [x] Frontend `/health` `200`.
- [x] Backend liveness `200`.
- [x] Backend readiness `200`.
- [x] MongoDB/Redis/MinIO đều `up`.
- [x] Public release SHA khớp expected SHA.
- [x] MinIO live endpoint `200`.
- [x] CORS cho phép đúng frontend origin.
- [x] Origin lạ không nhận allow-origin header.
- [x] HTTP redirect sang HTTPS.
- [x] TLS certificate đúng hostname.
- [x] MongoDB/Redis/MinIO console không public.

### 8.5. Environment templates

Tạo:

```text
deploy/env/develop.env.example
deploy/env/production.env.example
```

Hai môi trường không được dùng chung:

- Mongo database/user/password.
- JWT secret.
- MinIO credentials.
- Admin credentials.
- Resend credentials/config.
- Host ports.
- CORS origins.
- Public MinIO endpoint.

### 8.6. Nginx templates

Tạo:

```text
deploy/nginx/develop.conf.example
deploy/nginx/production.conf.example
```

Template cần có frontend/API/media virtual hosts, forwarded headers, body-size limit, timeouts và proxy về loopback ports. Không commit certificate hoặc private key.

### 8.7. Source tests

- [x] `bash -n` cho shell scripts.
- [ ] `shellcheck` cho shell scripts.
- [x] Compose render cho Development.
- [x] Compose render cho Production.
- [x] Reject environment ngoài allowlist.
- [x] Reject SHA sai format.
- [x] Reject mutable image tag.
- [x] Reject digest sai namespace/format.
- [ ] Test deploy lock.
- [ ] Test candidate success.
- [ ] Test pull/health failure.
- [ ] Test rollback success/failure.
- [ ] Xác minh secret không xuất hiện trong log.
- [x] `git diff --check`.

Source evidence ngày `2026-09-21`:

- `Jenkinsfile.release` đã tách builder và deploy node, dùng immutable digest,
  archive/fingerprint manifest, không checkout source hoặc cấp registry write
  credential trên deploy node. Production approver vẫn cố ý để placeholder và
  sẽ fail closed cho tới khi cấu hình Jenkins user IDs thật.
- Client lint/build PASS. Backend lint/build và `18/18` test suite,
  `153/153` test PASS.
- Client và server Docker image build PASS. File `/version.json` trong client
  image trả đúng SHA/environment; client Dockerfile từ chối build thiếu release
  provenance.
- Compose render PASS cho Development và Production. Hai shell script qua
  `bash -n`; các negative argument/allowlist/digest checks PASS; workflow GitHub
  Actions cũ đã được đồng bộ build arguments để không làm hỏng đường dự phòng.
- `shellcheck` và Jenkins Declarative validation chưa chạy do tool tương ứng
  không có trong máy local. Chưa có public/runtime proof; các test lock,
  candidate, rollback và secret-log vẫn phải chạy trong môi trường cô lập.

## 9. Phase 3 — Backup và migration safety

### Backup Production

- [ ] MongoDB bằng `mongodump --archive --gzip`.
- [ ] MinIO uploads bằng snapshot/mirror hoặc archive nhất quán.
- [ ] Runtime config và Compose.
- [ ] Nginx config.
- [ ] Release manifests.
- [ ] Jenkins configuration và credential encryption keys theo runbook Jenkins.
- [ ] Checksum cho từng backup artifact.
- [ ] Mã hóa backup chứa secret.
- [ ] Lưu ít nhất một bản ngoài VPS.
- [ ] Restore rehearsal trên database/volume tách biệt.

### Quy tắc migration

- Migration phải backward-compatible.
- Dùng quy trình expand → deploy code → contract.
- Không tự rollback database chỉ vì image rollback.
- Migration phá hủy dữ liệu cần approval riêng.
- Production deploy không được bắt đầu nếu backup/checksum chưa PASS.

### Recovery objectives

- `RPO (Recovery Point Objective)`: lượng dữ liệu tối đa chấp nhận mất, đo theo thời gian.
- `RTO (Recovery Time Objective)`: thời gian tối đa để khôi phục dịch vụ.

## 10. Phase 4 — Chuẩn bị runtime VPS

### Directory contract

```text
/opt/abslider/
├── bin/
│   ├── deploy-abslider
│   └── smoke-abslider
├── shared/
│   ├── compose.yml
│   ├── develop.env
│   ├── production.env
│   └── deploy.lock
├── releases/
│   ├── develop/
│   └── production/
└── backups/
```

### Permission contract

| Target | Owner/mode dự kiến |
|---|---|
| Wrapper | `root:root`, `0755` |
| Compose | `root:root`, `0644` |
| Secret env | `root:abslider-deploy`, `0640` |
| Release state | `abslider-deploy`, `0750` |
| Backup | quyền tối thiểu, không public |

### Runtime identity

- [x] `abslider-deploy` là system user, password locked.
- [x] Không dùng để SSH tương tác.
- [x] Không thuộc host `docker` group.
- [x] Không có `sudo`.
- [x] Rootless Docker riêng.
- [x] Linger enabled.
- [x] Không đọc Jenkins controller secrets.
- [x] Không ghi được wrapper/Compose root-owned.

Runtime proof ngày `2026-09-21`: rootless Docker restart PASS, daemon trở lại `active`, security có `rootless` và có `0` container trước khi triển khai.

## 11. Phase 5 — Jenkins deploy agent

### Security gate trước khi cấp deploy capability

Jenkins đang báo bản vá khả dụng cho Gradle Plugin, Pipeline: Multibranch, Script Security và Pipeline: Groovy Libraries. Trước khi lưu deploy-agent secret hoặc Production credential:

- [ ] Xác minh build queue trống và executor idle.
- [x] Ghi inventory Jenkins core/plugin hiện tại.
- [x] Tạo backup nhất quán của `JENKINS_HOME`, bao gồm jobs, plugins, credentials và encryption keys.
- [x] Tạo checksum và xác minh backup.
- [x] Cập nhật các plugin có security warning cùng dependency tương thích.
- [x] Restart Jenkins trong maintenance window.
- [x] Controller, CI agent và builder agent trở lại online.
- [x] Chạy smoke test CI/release artifact-only sau cập nhật.
- [x] Chỉ tiếp tục tạo deploy node khi security gate PASS.

Preflight security maintenance ngày `2026-09-21`:

- Jenkins core `2.568.3`; `JENKINS_HOME` khoảng `275 MB`, disk available khoảng `18 GB`.
- `gradle`: `2.19.1252.v15196b_5a_6e10`.
- `workflow-multibranch`: `841.vec5b_9e1806ec`.
- `script-security`: `1415.v9a_f9b_3a_c253d`.
- `workflow-cps-global-lib`: cảnh báo UI hiển thị `805.va_fc79344957d`; sẽ xác minh lại sau update.
- Controller, CI agent và builder agent đều active trước maintenance.
- Backup `/var/backups/jenkins/pre-plugin-update-20260921T025322Z`: Jenkins Home archive `215332157` bytes và infrastructure archive `2872` bytes; root-only mode `0600`, archive validation và SHA256 checksum đều PASS.
- Restart kiểm tra `jenkins.service` thành công; `http://127.0.0.1:8080/login` trả HTTP `200`. Hai service `jenkins-agent` và `jenkins-builder-agent` vẫn được giữ ở trạng thái dừng với `MainPID=0`.
- Lần kiểm tra trước khi tải update cho thấy `gradle=2.19.1252.v15196b_5a_6e10`, `workflow-multibranch=841.vec5b_9e1806ec` và `script-security=1415.v9a_f9b_3a_c253d` vẫn là các phiên bản cũ; không thấy lỗi nạp plugin trong journal.
- Plugin Manager đã tải thành công đúng bốn bản cập nhật `Gradle`, `Pipeline: Groovy Libraries`, `Pipeline: Multibranch` và `Script Security`; tất cả đang ở trạng thái chờ kích hoạt trong lần khởi động Jenkins tiếp theo. Build agents vẫn dừng.
- Sau restart, `Gradle=2.20.1253.vc116f0763a_eb_`, `Pipeline: Multibranch=842.v3a_b_59b_57b_e6e` và `Script Security=1429.v0810f1b_530f5` đã được kích hoạt; controller HTTP `200`, journal không có lỗi nạp plugin và agents vẫn dừng. `Pipeline: Groovy Libraries` còn chờ kiểm tra lại bằng đúng plugin ID `pipeline-groovy-lib`.
- `Pipeline: Groovy Libraries` đã được xác minh bằng đúng plugin ID `pipeline-groovy-lib` ở phiên bản `806.v408277b_33d1d`. Rootless builder daemon trả `security=rootless`; `jenkins`, `jenkins-agent` và `jenkins-builder-agent` đều trở lại trạng thái systemd `active`. Smoke test job vẫn phải PASS trước khi đóng security gate.
- Remoting log xác nhận `abslider-agent-01` và `abslider-builder-01` đều mở WebSocket rồi báo `Connected`; trang Nodes hiển thị cả hai node online, đồng bộ clock và có disk/swap monitor bình thường.
- Post-update smoke `abslider-ci/PR-13 #20` chạy trên `abslider-agent-01`: CI context, clean install, client/server lint và build đều PASS; backend đạt `18/18` suite, `150/150` test, JUnit/artifact post-actions hoàn tất và Pipeline kết thúc `SUCCESS`. Job không dùng Docker registry và không deploy. Security gate trước khi tạo deploy node PASS.
- Sau backup, controller online; `jenkins-agent` và `jenkins-builder-agent` có `MainPID=0` để ngăn job chạy trong lúc cập nhật.

Tạo node:

```text
Name: abslider-deploy-01
Remote root: /var/lib/abslider-deploy
Executors: 1
Usage: EXCLUSIVE
Labels: linux abslider-deploy
```

Job restriction:

```regex
^abslider-release/(develop|main)(/.*)?$
```

Node `abslider-deploy-01` đã được tạo ngày `2026-09-21` với một executor, remote root `/var/lib/abslider-deploy`, labels `linux abslider-deploy`, usage `EXCLUSIVE`, inbound launch và trạng thái ban đầu `Offline`. Job restriction dùng `Regular Expression (Job name)` với regex subtree ở trên; agent secret chưa được đưa vào runtime tại thời điểm này.

Deploy-agent bootstrap: Remoting JAR `3355.3357.v931d3c992987`, `1406408` bytes, SHA256 `4ae5bbd00b0f79f4453d20fbb6b70dcac4d0a9a4d21d85b18b2c72dd9d117aae` được cài root-owned tại `/usr/local/lib/jenkins-deploy-agent/agent.jar`. Secret có định dạng 64 ký tự hex cộng newline, nằm tại `/etc/jenkins-deploy-agent/secret`, owner `root:abslider-deploy`, mode `0640`; service account đọc được file này nhưng không đọc được Jenkins controller master key.

Systemd unit `jenkins-deploy-agent.service` đã được validate, enable và start. Unit chạy bằng `abslider-deploy`, có `NoNewPrivileges`, `PrivateTmp`, `PrivateDevices`, `ProtectSystem=strict`, chỉ mở write path `/var/lib/abslider-deploy`; Docker client trỏ tới `/run/user/999/docker.sock` và daemon báo `security=rootless`. Remoting work-dir và Jenkins Nodes sau đó đều xác nhận agent đã `Connected`.

Remoting log sau đó xác nhận `Setting up agent: abslider-deploy-01`, WebSocket mở và `Connected`; service giữ `NRestarts=0`, `MainPID` chạy bằng `abslider-deploy`. Node deploy đã online. Trước khi chạy job, còn phải xác minh cấu hình job restriction và quyền ghi/đọc đúng contract.

Isolation audit PASS: `abslider-deploy` có shell `nologin`, password locked, không thuộc group `docker`, không có sudo; chỉ ghi được `/opt/abslider/releases`, không ghi được trusted bin/shared config, systemd unit hay agent secret. User không đọc được Jenkins master key và chỉ dùng daemon rootless riêng với `0` container. Jenkins node config xác nhận một executor, `EXCLUSIVE`, labels `linux abslider-deploy`, inbound launcher, `RegexNameRestriction` là `^abslider-release/(develop|main)(/.*)?$` và `checkShortName=false`; agent service enabled/active.

Builder isolation audit PASS ngày `2026-09-21`: node `abslider-builder-01`
có remote root `/var/lib/jenkins-builder`, một executor, `EXCLUSIVE`, labels
`linux node24 docker-builder`, cùng `RegexNameRestriction`
`^abslider-release/(develop|main)(/.*)?$` và `checkShortName=false`. Service
`jenkins-builder-agent` enabled/active; Docker data root riêng tại
`/var/lib/jenkins-builder/.local/share/docker`, security có `rootless` và có
`0` runtime container tại thời điểm audit.

Agent baseline audit ngày `2026-09-21`:

- Controller: Jenkins `2.568.3`, bind `127.0.0.1:8080`, login endpoint trả HTTP `200`.
- Runtime Java: OpenJDK `21.0.12`.
- Remoting JAR hiện hữu: `1406408` bytes, SHA256 `4ae5bbd00b0f79f4453d20fbb6b70dcac4d0a9a4d21d85b18b2c72dd9d117aae`.
- Secret của mỗi agent nằm trong file riêng `root:<agent-group>` mode `0640`; không đặt trực tiếp trong unit.
- Deploy node phải kế thừa `NoNewPrivileges`, `PrivateTmp`, `ProtectSystem=strict`, rootless socket và workspace riêng; không tái sử dụng agent secret hiện hữu.

### Acceptance criteria

- [x] PR/CI jobs không thể chạy trên deploy node.
- [x] Builder không quản lý runtime containers.
- [x] Deploy node không nhận Docker Hub write token.
- [x] Deploy node chỉ nhận release manifest.
- [x] Deploy node không checkout source.
- [x] Deploy node không có sudo/rootful Docker.

## 12. Phase 6 — Development DNS/Nginx/TLS

- [ ] PM xác nhận domain Development.
- [ ] Tạo DNS A records.
- [ ] Chỉ tạo AAAA sau khi IPv6/firewall được kiểm thử.
- [ ] Cài Nginx virtual hosts.
- [ ] `nginx -t` PASS.
- [ ] Reload Nginx.
- [ ] Cấp TLS bằng Certbot.
- [ ] HTTP redirect sang HTTPS.
- [ ] Public HTTPS PASS.
- [ ] Certbot renewal dry-run PASS.
- [ ] App ports chỉ bind loopback.
- [ ] Jenkins/Kiwi virtual hosts không thay đổi ngoài dự kiến.

## 13. Phase 7 — Development deployment đầu tiên

### Gate A — Artifact-only

- [ ] Giữ `DEPLOY_ENABLED=false`.
- [ ] Release quality gates PASS.
- [ ] Client/server image push PASS.
- [ ] Registry trả digest hợp lệ.
- [ ] Release manifest archived/fingerprinted.
- [ ] Docker Hub manifest lookup PASS.
- [ ] Không tạo runtime container.

### Gate B — Manual Development deploy

- [ ] Chạy đúng build với deploy enabled.
- [ ] Deploy node nhận manifest.
- [ ] Pull đúng digest.
- [ ] Compose project là `abslider-develop`.
- [ ] Toàn bộ containers healthy.
- [ ] Internal readiness PASS.
- [ ] Public smoke PASS.
- [ ] Public SHA khớp manifest.
- [ ] Jenkins build SUCCESS.

### Gate C — Reboot persistence

- [ ] Reboot VPS có kiểm soát.
- [ ] Jenkins, Kiwi, Nginx và ABSlider tự khởi động.
- [ ] Rootless Docker deploy daemon active.
- [ ] Public endpoints phục hồi.
- [ ] Runtime digest không thay đổi sau reboot.

## 14. Phase 8 — Rollback drill

- [ ] Giữ một Development release khỏe làm previous.
- [ ] Chuẩn bị candidate test cố ý unhealthy trong namespace hợp lệ.
- [ ] Deploy candidate và xác nhận health failure.
- [ ] Wrapper tự deploy lại previous digest.
- [ ] `current` không trỏ candidate lỗi.
- [ ] Container chạy previous digest.
- [ ] Public frontend/API trở lại `200`.
- [ ] Public SHA là previous SHA.
- [ ] Jenkins build FAILURE do candidate lỗi.
- [ ] Log ghi `ROLLBACK_SUCCEEDED`.
- [ ] Thử rollback failure và xác nhận `ROLLBACK_FAILED`.

Chỉ đánh dấu `ROLLBACK_VERIFIED` sau khi diễn tập runtime thực tế.

## 15. Phase 9 — Auto-deploy Development

- [ ] Chuyển `develop` sang deploy tự động.
- [ ] `main` vẫn bắt buộc approval.
- [ ] Cấu hình GitHub webhook cho Jenkins.
- [ ] Giữ periodic scan làm fallback.
- [ ] Push thay đổi kiểm tra có chủ ý.
- [ ] Jenkins CI tự chạy.
- [ ] Jenkins Release tự build/publish.
- [ ] Development tự deploy.
- [ ] Public smoke PASS.
- [ ] Ghi thời gian từ push tới khi live.

## 16. Phase 10 — Production delivery

- [ ] Development ổn định và được nghiệm thu.
- [ ] Branch protection cho `develop`/`main` được bật.
- [ ] Mở PR `develop → main`.
- [ ] Jenkins CI PASS và có review.
- [ ] Merge, không force-push.
- [ ] Jenkins build/publish Production images.
- [ ] Production backup/checksum PASS.
- [ ] Pipeline dừng ở approval.
- [ ] Chỉ PM/Release Manager được duyệt.
- [ ] Jenkins ghi `APPROVED_BY`.
- [ ] Deploy `abslider-production`.
- [ ] Internal readiness PASS.
- [ ] Public smoke PASS.
- [ ] Public SHA/digest khớp manifest.
- [ ] Theo dõi logs/tài nguyên sau deploy.
- [ ] Nếu candidate lỗi, rollback previous digest.
- [ ] Không rollback database tự động.

## 17. Phase 11 — Kiwi TCMS integration

- [ ] Tạo `jenkins_automation` riêng.
- [ ] Không cấp Administrator.
- [ ] Chỉ cấp quyền Test Run/Test Execution cần thiết.
- [ ] Ánh xạ Git SHA thành Kiwi Build.
- [ ] Ánh xạ Jenkins build thành Test Run.
- [ ] Đồng bộ JUnit result thành Test Executions.
- [ ] Lưu Jenkins Build URL trong Kiwi.
- [ ] Giai đoạn đầu, lỗi gửi Kiwi chỉ cảnh báo và chưa chặn deploy.
- [ ] Chỉ nâng thành release gate sau khi integration ổn định.

## 18. Phase 12 — Gỡ pipeline cũ và hoàn thiện vận hành

Chỉ gỡ `.github/workflows/publish-images.yml` sau khi:

- [ ] Jenkins publish PASS nhiều lần.
- [ ] Development auto-deploy PASS.
- [ ] Rollback drill PASS.
- [ ] Production approval/deploy PASS.
- [ ] Có runbook rollback Jenkins.

Workflow `.github/workflows/publish-images.yml` đã được gỡ sau khi Jenkins build/publish và Production deploy có runtime proof. Sau khi merge thay đổi này vào từng nhánh:

- [ ] Push thử và xác minh không còn GitHub Actions publish run.
- [ ] Thu hồi credential GHCR không còn dùng.
- [ ] Không xóa digest đang được Development/Production tham chiếu.
- [ ] Cập nhật `docs/devops-change-log.md`.
- [ ] Hoàn thiện deploy/rollback/backup runbook.

## 19. Jira subtask đề xuất

1. Re-audit source và bảo toàn dirty worktree.
2. Audit capacity/port/runtime trên VPS.
3. Harden Jenkins release pipeline.
4. Bổ sung release provenance.
5. Harden deploy/rollback wrapper.
6. Tạo public smoke-test script.
7. Tạo environment và Nginx templates.
8. Thiết lập backup và restore rehearsal.
9. Thiết lập rootless deploy runtime.
10. Tạo Jenkins deploy agent.
11. Cấu hình Development DNS/Nginx/TLS.
12. Deploy Development lần đầu.
13. Diễn tập rollback Development.
14. Kích hoạt auto-deploy từ `develop`.
15. Cấu hình branch protection/Production approvers.
16. Merge `develop` vào `main`.
17. Deploy Production có approval.
18. Tích hợp Jenkins với Kiwi TCMS.
19. Gỡ GitHub Actions cũ.
20. Hoàn thiện evidence và runbook.

## 20. Definition of Done — KAN-51

- [ ] Source CD đã merge vào `develop` sau review.
- [ ] Push `develop` tự deploy Development.
- [ ] Client/server chạy đúng immutable digest.
- [ ] Public endpoint chứng minh đúng release SHA.
- [ ] Readiness kiểm tra MongoDB, Redis và MinIO.
- [ ] Public smoke test PASS.
- [ ] Rollback drill thực tế PASS.
- [ ] `main` yêu cầu manual approval.
- [ ] Chỉ PM/Release Manager được approve.
- [ ] Production backup và restore rehearsal PASS.
- [ ] Production deploy PASS.
- [ ] Secrets không xuất hiện trong Git/Jenkins log/artifact.
- [ ] Development/Production không dùng chung volumes/credentials.
- [ ] Jenkins/Kiwi không bị ảnh hưởng.
- [ ] Reboot VPS không làm mất runtime.
- [x] GitHub Actions cũ được gỡ sau khi Jenkins thay thế hoàn toàn.
- [ ] DevOps changelog và runbook được cập nhật.

## 21. Evidence log

Điền sau từng gate, không ghi secret vào bảng.

| Ngày | Environment | Git SHA | Client digest | Server digest | Jenkins build | Health/smoke | Rollback | Người xác minh |
|---|---|---|---|---|---|---|---|---|
|  |  |  |  |  |  |  |  |  |

## 22. Điều tuyệt đối không làm

- Không deploy bằng `latest`, `develop` hoặc `main` tag.
- Không lưu `.env`, token, password hoặc private key trong Git.
- Không đưa Jenkins users vào host `docker` group.
- Không cấp deploy agent quyền `sudo`.
- Không dùng chung database/volume/secrets giữa hai môi trường.
- Không deploy `main` cũ trước Development gate.
- Không coi internal HTTP `200` là public deployment proof.
- Không coi source có rollback là bằng chứng rollback đã hoạt động.
- Không tự động rollback database migration.
- Không xóa previous release/backup ngay sau deploy.
- Không gỡ GitHub Actions trước khi Jenkins CD có runtime proof.

## 23. Thứ tự thực hiện bắt buộc

```text
Đồng bộ source
  -> audit VPS
  -> harden source CD
  -> source/static/runtime test
  -> dựng Development
  -> public smoke
  -> rollback drill
  -> auto-deploy develop
  -> backup/restore rehearsal
  -> Production approval
  -> Production deploy
  -> Kiwi TCMS integration
  -> gỡ pipeline cũ
```
