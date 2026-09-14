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

## 2026-09-13 — Bootstrap Jenkins controller local trên Ubuntu

### Mục tiêu

Cài Jenkins LTS phục vụ học tập và xây CI cho hai nhánh `developer`/`main`, đồng thời giới hạn giao diện controller về loopback trước khi mở khóa hoặc cấu hình credential.

### Thay đổi trên host

- Host: Ubuntu 24.04.4 LTS, kernel `7.0.0-31-generic`, kiến trúc amd64.
- Cài `fontconfig` và OpenJDK 21 từ Ubuntu repository:
  - `openjdk-21-jre 21.0.12+8-1~24.04`.
  - `openjdk-21-jre-headless 21.0.12+8-1~24.04`.
- Thêm Jenkins Debian stable repository bằng signing key `jenkins.io-2026.key`.
- Cài Jenkins LTS `2.568.3` bằng APT.
- Jenkins chạy dưới system user/group riêng `jenkins:jenkins`, UID `125`, GID `127`.
- Tạo systemd drop-in `/etc/systemd/system/jenkins.service.d/override.conf`:

```ini
[Service]
Environment="JENKINS_LISTEN_ADDRESS=127.0.0.1"
```

- Không sửa trực tiếp unit `/usr/lib/systemd/system/jenkins.service` do package quản lý.
- Chưa thêm user `jenkins` vào group `docker`; quyền Docker sẽ được xử lý ở gate riêng vì có mức quyền tương đương root trên host.
- Không chạy `apt autoremove` và không nâng đồng loạt 66 package ngoài phạm vi.
- Hoàn tất setup wizard trên `http://127.0.0.1:8080`, tạo tài khoản quản trị riêng và vào được Dashboard; không ghi username/password vào repository hoặc nhật ký.
- Các plugin cốt lõi đã cài:
  - Pipeline, Pipeline Graph View.
  - Git, GitHub Branch Source.
  - Credentials Binding.
  - NodeJS.
  - Matrix Authorization Strategy.
  - SSH Build Agents.

### Bằng chứng kiểm tra

| Kiểm tra | Kết quả | Ghi chú |
|---|---|---|
| Java runtime | PASS | OpenJDK `21.0.12` |
| Jenkins package | PASS | `jenkins 2.568.3 install ok installed` |
| systemd enable | PASS | `UnitFileState=enabled` |
| systemd runtime | PASS | `ActiveState=active`, `SubState=running` |
| systemd override | PASS | `DropInPaths=/etc/systemd/system/jenkins.service.d/override.conf` |
| Bind address | PASS | `[::ffff:127.0.0.1]:8080`; loopback only, không còn `*:8080` |
| Docker privilege | NOT_CONFIGURED | Group `docker` hiện chỉ có user `duckcy`; user `jenkins` chưa được cấp quyền |
| Jenkins setup wizard | PASS | Đã mở khóa, tạo admin riêng và vào Dashboard |
| Core plugins | PASS | Các file `.jpi` cốt lõi tồn tại; không phát hiện file `.failed` |
| Pipeline/job | NOT_CONFIGURED | Chưa tạo Jenkinsfile hoặc Multibranch Pipeline |

### Trạng thái

| Mức | Trạng thái |
|---|---|
| Jenkins package/service | `TEST_PASS` — host local |
| Network exposure | `TEST_PASS` — loopback only |
| Setup wizard/plugins | `TEST_PASS` — host local |
| Docker agent capability | `PLANNED` |
| Initial bootstrap documentation | `PUSHED` — `4c02db4a70d7f3c8ea4c96da79914ecfebe43708` |
| Wizard documentation update | `PUSHED` — `a1f39223cd7545ca531ac6ec5f9121e525b08c4d` |
| Production | Chưa deploy |

---

## 2026-09-13 — Tạo danh tính hệ điều hành riêng cho Jenkins build agent

### Mục tiêu

Chuẩn bị build agent tách biệt khỏi tiến trình Jenkins controller trên cùng host. Agent dùng tài khoản hệ điều hành riêng, không có login shell, chưa được cấp Docker và không được đọc secret của controller.

### Thay đổi trên host

- Tạo system group `jenkins-agent`.
- Tạo system user `jenkins-agent`, UID `997`, primary GID `983`.
- Đặt home/workspace tại `/var/lib/jenkins-agent` với owner `jenkins-agent:jenkins-agent` và mode `0750`.
- Đặt shell `/usr/sbin/nologin` để tài khoản không dùng cho đăng nhập tương tác.
- Chưa thêm `jenkins-agent` vào group `docker`; quyền này chỉ cấp sau khi node kết nối và gate cách ly đạt.
- Đăng ký permanent node `abslider-agent-01` trên Jenkins:
  - Remote root `/var/lib/jenkins-agent`.
  - Một executor.
  - Labels `linux node24`.
  - Usage chỉ nhận job có label khớp.
  - Launch method inbound: agent chủ động kết nối tới controller.
- Tải Jenkins Remoting `agent.jar` từ chính controller và chạy bằng user `jenkins-agent`.
- Lưu inbound-agent secret ngoài repository tại `/etc/jenkins-agent/secret`, owner `root:jenkins-agent`, mode `0640`; agent nhận secret qua đối số `-secret @file` thay vì để giá trị xuất hiện trong process arguments.
- Tạo `/var/lib/jenkins-agent/remoting`, owner `jenkins-agent:jenkins-agent`, mode `0700` làm Remoting work directory.
- Cài bản `agent.jar` dùng cho service tại `/usr/local/lib/jenkins-agent/agent.jar`, owner `root:root`, mode `0644`, để build user không thể tự thay thế executable của service.
- Tạo và enable `/etc/systemd/system/jenkins-agent.service`:
  - Chạy trực tiếp Java process bằng `jenkins-agent:jenkins-agent`, không qua shell wrapper.
  - Tự khởi động cùng host và tự restart khi process lỗi.
  - Chỉ cho phép ghi vào `/var/lib/jenkins-agent`.
  - Bật `NoNewPrivileges`, private `/tmp` và các bảo vệ kernel/control-group của systemd.

### Bằng chứng kiểm tra

| Kiểm tra | Kết quả | Ghi chú |
|---|---|---|
| System identity | PASS | `jenkins-agent`, UID `997`, primary group `jenkins-agent` GID `983` |
| Home permission | PASS | `drwxr-x--- jenkins-agent:jenkins-agent /var/lib/jenkins-agent` |
| Login shell | PASS | `/usr/sbin/nologin` |
| Java runtime của agent | PASS | OpenJDK `21.0.12` |
| Controller secret isolation | PASS | Agent không đọc được `/var/lib/jenkins/secrets/master.key` |
| Docker privilege | NOT_CONFIGURED | Agent chưa thuộc group `docker` |
| Jenkins node registration | PASS | Node `abslider-agent-01` xuất hiện trên Dashboard |
| Secret provisioning lần đầu | FAIL | File secret có `size=1`, chỉ chứa newline nên chưa có credential thực |
| Remoting work directory lần đầu | FAIL | `-failIfWorkDirIsMissing` dừng tiến trình vì thiếu `/var/lib/jenkins-agent/remoting` |
| Secret provisioning sau sửa | PASS | Nhập đủ 64 ký tự; file có `size=65`, quyền `-rw-r----- root:jenkins-agent` |
| Remoting work directory sau sửa | PASS | Agent đọc được secret và ghi được vào thư mục `remoting` |
| Jenkins node connection | PASS | Remoting `3355.3357.v931d3c992987`; `WebSocket connection open`; `Connected` |
| systemd unit validation | PASS | `systemd-analyze verify` không báo lỗi |
| Persistent service | PASS | `enabled`, `active/running`, PID `102398`, `NRestarts=0` tại thời điểm kiểm tra |
| Service identity/hardening | PASS | `User=jenkins-agent`, `Group=jenkins-agent`, `NoNewPrivileges=yes` |
| Root-owned Remoting binary | PASS | `-rw-r--r-- root:root`, kích thước `1406408` byte |
| Persistent controller connection | PASS | Có TCP session `ESTABLISHED` giữa agent và controller qua loopback port `8080` |

### Trạng thái

| Mức | Trạng thái |
|---|---|
| Host account | `TEST_PASS` — host local |
| Controller secret isolation | `TEST_PASS` — host local |
| Jenkins agent foreground smoke | `TEST_PASS` — kết nối WebSocket thành công |
| Persistent systemd service | `TEST_PASS` — host local |
| Agent job execution | `TEST_PASS` — Jenkins CI build `abslider-ci/developer #1` |
| Repository documentation | `PUSHED` — `41bec707dbf1d342e50dadea0c0730a4e57fe66f` |
| Production | Chưa deploy |

---

## 2026-09-13 — Khởi tạo Jenkins CI cho backend unit test

### Mục tiêu và phạm vi

Tạo Pipeline-as-Code để Jenkins tự động clean-install và chạy backend unit test cho hai nhánh `developer`, `main` cùng pull request hướng vào hai nhánh này.

Phạm vi của bước này chỉ là CI:

- Không có stage deploy, publish image hoặc thay đổi môi trường chạy ứng dụng.
- Không chạy Docker/Testcontainers hay backend integration test.
- Chưa chạy frontend unit test vì `client/package.json` hiện chưa có test script.
- Coverage được thu thập và lưu làm artifact nhưng chưa đặt ngưỡng fail do dự án chưa có coverage contract được nhóm phê duyệt.

### Thay đổi

- Cấu hình Jenkins NodeJS Tool `nodejs-24`, auto-install chính xác Node.js `24.21.0`; Jenkins đã cài tool này trên agent ở lần chạy Pipeline đầu tiên.
- Thêm `server/package.json` scripts:
  - `test:unit`: chạy riêng `tests/unit` tuần tự.
  - `test:unit:ci`: chạy unit test ở CI mode, thu coverage và xuất JUnit XML.
- Thêm dev dependency cố định `jest-junit@17.0.0` và cập nhật `server/package-lock.json`.
- Ignore `server/reports/` vì đây là test output sinh tự động.
- Tạo `Jenkinsfile` tại repository root với các đặc tính:
  - Chỉ nhận agent có labels `linux && node24` và dùng tool `nodejs-24`.
  - Giới hạn context vào `developer`, `main` hoặc pull request có target là một trong hai nhánh này.
  - Xác minh agent chạy bằng `jenkins-agent`, không đọc được controller master key, và dùng đúng Node `24.21.0`/npm `11.19.0`.
  - Chạy `npm ci --no-audit --no-fund` trong `server` rồi chạy `npm run test:unit:ci`.
  - Publish `server/reports/junit/server-unit.xml`, archive coverage, giới hạn lịch sử build/artifact, chặn build trùng, timeout 20 phút và dọn workspace.

### Bằng chứng kiểm tra local

| Kiểm tra | Kết quả | Ghi chú |
|---|---|---|
| Backend clean install | PASS có cảnh báo | 866 package; còn cảnh báo Babel peer/deprecation và npm install-script policy đã ghi nhận từ trước |
| Unit test selection | PASS | 17 file dưới `server/tests/unit`; không chọn 4 integration test |
| Backend unit tests | PASS | 17/17 suites, 128/128 tests, 0 snapshot |
| JUnit report | PASS | XML ghi `tests=128`, `failures=0`, `errors=0` |
| Coverage collection | PASS | Statements `76.96%`, branches `57.08%`, functions `79.24%`, lines `78.34%` |
| Backend lint | PASS | `npm run lint` |
| Whitespace/error markers | PASS | `git diff --check` |
| Jenkins runtime trước push | NOT_RUN | Đây là trạng thái trước khi commit `1ee139c` được push và Jenkins chạy build đầu tiên |

### Bằng chứng Jenkins runtime ngày 2026-09-14

- Multibranch Pipeline: `abslider-ci` / display name `ABSlider CI`.
- Jenkins lấy `Jenkinsfile` từ đúng commit `1ee139c232aad32850f13b38f28a2a0172fcff93` trên nhánh `developer`.
- Build chạy trên `abslider-agent-01` tại `/var/lib/jenkins-agent/workspace/abslider-ci_developer`.
- NodeJS Plugin tự giải nén Node.js `24.21.0` vào tool directory của agent.
- Pipeline xác minh đúng Node `v24.21.0`, npm `11.19.0`, node `abslider-agent-01`, user `jenkins-agent` và controller master key không đọc được.
- `npm ci --no-audit --no-fund` cài 866 package trong khoảng 13 giây.
- Unit test hoàn tất trong 1.662 giây: 17/17 suites và 128/128 tests PASS.
- Jenkins ghi nhận JUnit result, archive coverage, dọn workspace và kết thúc `Finished: SUCCESS`.
- Sau khi Built-In Node được đặt về `0` executor, chạy lại Pipeline `abslider-ci/developer #2` trên commit `5c034693fe875d471efab0de82e99cadb8c5776c`.
- Build #2 tiếp tục được Jenkins giao cho `abslider-agent-01`, chạy bằng `jenkins-agent` và không đọc được controller master key; đây là bằng chứng workload CI vẫn hoạt động khi controller không nhận build.
- Build #2 tái sử dụng NodeJS Tool đã cache, hoàn tất `npm ci` trong khoảng 5 giây và unit test trong 1.156 giây; tổng thời gian từ lúc bắt đầu đến `Finished: SUCCESS` khoảng 11 giây.
- Tạo Jenkins credential ID `github-abslider-readonly` theo loại `Username with password`; password là fine-grained GitHub PAT chỉ có quyền đọc tài nguyên public và không được ghi vào repository.
- Gắn credential này vào GitHub Branch Source để controller xác thực các API request phục vụ branch/PR indexing. Theo hành vi thực tế của GitHub Branch Source, cùng credential cũng được dùng qua `GIT_ASKPASS` cho HTTPS checkout.
- Lần scan có xác thực bắt đầu lúc 00:52:22, xử lý 6 branch và 1 pull request trong 8.1 giây, không còn thời gian chờ do anonymous API limiter.
- Scan phát hiện `developer` đổi từ `1ee139c232aad32850f13b38f28a2a0172fcff93` sang `45ec9a9416d2f25e3a88c228c4079a17913edb87`, tìm thấy `Jenkinsfile` và tự lên lịch build cho branch.
- Build #3 lấy `Jenkinsfile` và checkout đúng commit `45ec9a9416d2f25e3a88c228c4079a17913edb87`, chạy trên `abslider-agent-01` bằng user `jenkins-agent` với Node `24.21.0` và npm `11.19.0`.
- Build #3 hoàn tất `npm ci` trong khoảng 5 giây và unit test trong 1.292 giây: 17/17 suites, 128/128 tests PASS; JUnit/coverage được lưu và Pipeline kết thúc `Finished: SUCCESS`.
- GitHub từ chối hai lần cập nhật commit status với HTTP `403 Resource not accessible by personal access token`. Đây không làm Jenkins build thất bại nhưng GitHub chưa nhận được trạng thái CI, nên chưa thể dùng Jenkins làm required status check.
- Tạo GitHub App `abslider-jenkins-duckcy`, App ID `4932639`, với quyền tối thiểu: `Contents: Read-only`, `Metadata: Read-only`, `Pull requests: Read-only`, `Commit statuses: Read and write`; webhook đang tắt vì Jenkins chỉ nghe trên loopback.
- Repository owner đã cài App và giới hạn installation vào repository `zunohoang/open4um`.
- GitHub private key được đặt quyền `0600`, chuyển sang PKCS#8 và kiểm tra `Key is valid`; key không được ghi vào repository hay log terminal.
- Tạo Jenkins GitHub App credential ID `github-app-abslider-ci`, sau đó thay GitHub Branch Source credential từ PAT sang credential này; PAT cũ tạm giữ làm rollback cho tới khi xác minh xong.
- Lần scan bằng GitHub App bắt đầu lúc 10:23:01, xử lý 6 branch và 1 pull request trong 5.1 giây, xác nhận `developer` vẫn ở `0a6b798173edb7307349dd11a470f0e2adc1551b` và kết thúc `Finished: SUCCESS`.
- Scan không tạo build mới vì không phát hiện thay đổi, nên chạy thủ công build `abslider-ci/developer #6` để kiểm tra quyền publish commit status.
- Build #6 kết nối bằng GitHub App, checkout đúng commit `0a6b798173edb7307349dd11a470f0e2adc1551b`, chạy trên `abslider-agent-01`, hoàn tất `npm ci` trong khoảng 6 giây và unit test trong 1.254 giây: 17/17 suites, 128/128 tests PASS.
- Build #6 ghi JUnit/coverage, kết thúc `Finished: SUCCESS` và log xác nhận `GitHub has been notified of this commit’s build result`; không còn HTTP `403`.
- GitHub Commit Status API được kiểm tra độc lập: aggregate state `success`, một context `continuous-integration/jenkins/branch`, description `This commit looks good` cho commit `0a6b798`.
- Status `target_url` hiện trỏ tới Jenkins loopback `127.0.0.1`, nên chỉ mở được trên host này; publish status đã hoạt động nhưng chia sẻ build log cho thành viên từ xa vẫn chưa khả dụng.

| Kiểm tra runtime | Kết quả | Ghi chú |
|---|---|---|
| Multibranch indexing anonymous | PASS có cảnh báo | Lần đầu tìm thấy `Jenkinsfile` trên `developer`; indexing mất khoảng 15 phút do GitHub API anonymous rate limiter |
| GitHub scan credential | PASS | Dùng `github-abslider-readonly`; log xác nhận kết nối GitHub API bằng credential mô tả `GitHub public-read credential for ABSlider CI scan` |
| Authenticated indexing | PASS | 6 branch và 1 pull request trong 8.1 giây; không còn Jenkins-imposed API limiter |
| Change detection | PASS | Phát hiện `developer` đổi từ `1ee139c` sang `45ec9a9` và lên lịch build |
| Authenticated checkout | PASS | Build #3 checkout đúng `45ec9a9`; GitHub Branch Source dùng `github-abslider-readonly` qua `GIT_ASKPASS` |
| GitHub commit status qua PAT | BLOCKED | GitHub trả HTTP `403` vì public-read PAT không có quyền tạo commit status |
| GitHub App installation | PASS | App ID `4932639` được owner cài và giới hạn vào `zunohoang/open4um` |
| Jenkins GitHub App credential | PASS | Credential ID `github-app-abslider-ci`; private key PKCS#8 hợp lệ và lưu trong Jenkins Credentials |
| GitHub App indexing | PASS | Kết nối bằng App credential; scan 6 branch và 1 pull request trong 5.1 giây |
| GitHub commit status qua App | PASS | Build #6 thông báo GitHub thành công; public Status API trả context `continuous-integration/jenkins/branch` ở state `success` |
| GitHub status target URL | LIMITATION | Link build trỏ tới `http://127.0.0.1:8080/...`; chỉ truy cập được trên Jenkins host |
| Git checkout | PASS | Build #1 checkout `1ee139c`, #2 `5c03469`, #3 `45ec9a9`, #6 `0a6b798`; system Git `2.43.0`; chưa cấu hình named Git tool |
| NodeJS auto-install | PASS | Node `24.21.0`, npm `11.19.0` trên agent |
| Agent identity/isolation | PASS | `jenkins-agent`; không đọc được controller master key |
| Backend clean install | PASS có cảnh báo | Peer/deprecation và npm install-script warnings vẫn hiện nhưng lệnh exit `0` |
| Backend unit tests | PASS | 17/17 suites, 128/128 tests |
| JUnit publish | PASS | Jenkins hiển thị 128 tests, không failure |
| Coverage artifact | PASS | Coverage được archive trước khi workspace bị xóa |
| GitHub Checks publish | NOT_CONFIGURED | `[Checks API] No suitable checks publisher found`; không làm build thất bại |
| Controller workload isolation | PASS | Sau khi Built-In Node được đặt `0` executor, build #2 vẫn được giao cho `abslider-agent-01` |
| Repeat CI build | PASS | `abslider-ci/developer #2`, commit `5c034693fe875d471efab0de82e99cadb8c5776c` |
| NodeJS Tool cache reuse | PASS | Build #2 dùng đúng Node `24.21.0`/npm `11.19.0` mà không phải giải nén lại tool |
| Pipeline result | PASS | Các build có bằng chứng `abslider-ci/developer #1`, `#2`, `#3` và `#6` đều kết thúc `Finished: SUCCESS` |

### File bị ảnh hưởng

- `Jenkinsfile`
- `server/package.json`
- `server/package-lock.json`
- `server/.gitignore`
- `docs/devops-change-log.md`

### Trạng thái

| Mức | Trạng thái |
|---|---|
| Backend unit-test command | `TEST_PASS` — local |
| JUnit/coverage output | `TEST_PASS` — local |
| Jenkinsfile | `TEST_PASS` — Jenkins runtime trên agent |
| Commit/push | `PUSHED` — `1ee139c232aad32850f13b38f28a2a0172fcff93` |
| CI runtime | `TEST_PASS` — `abslider-ci/developer #1`, `#2`, `#3` và `#6` |
| GitHub API authentication | `TEST_PASS` — GitHub App credential, authenticated scan |
| GitHub status publishing | `TEST_PASS` — Jenkins log và public GitHub Status API |
| Automatic GitHub trigger | `PLANNED` — authenticated manual scan đã PASS; chưa cấu hình periodic scan hoặc webhook |
| CD/deployment | Ngoài phạm vi task |

---

## 2026-09-13 — Nâng bcrypt 6 và loại security gate high/critical

### Mục tiêu

Loại chuỗi dependency production có lỗ hổng high/critical đã phát hiện trong CI rehearsal, nhưng không dùng `npm audit fix --force` và không thay đổi các dependency ngoài phạm vi.

### Thay đổi

- Nâng dependency trực tiếp `bcrypt` từ `^5.1.1` lên `^6.0.0`.
- Cập nhật `server/package-lock.json` bằng Node `24.21.0`, npm `11.19.0`.
- Lockfile loại bỏ 35 package, trong đó có chuỗi dễ tổn thương:
  - `@mapbox/node-pre-gyp@1.0.11`.
  - `tar@6.2.1`.
- Bcrypt 6 dùng `node-gyp-build` và vẫn giữ API `hash`, `compare`, `getRounds` tương thích với code hiện tại.

### Bằng chứng kiểm tra

| Kiểm tra | Kết quả | Ghi chú |
|---|---|---|
| Server clean install | PASS có cảnh báo | `npm ci`; 863 package sau audit, còn Babel peer/deprecation và install-script warnings |
| Dependency tree | PASS | Chỉ còn `bcrypt@6.0.0`; không còn `@mapbox/node-pre-gyp` hoặc `tar` trong cây server |
| Local native bcrypt smoke | PASS | Hash/compare đúng, cost rounds `10` |
| Production security gate | PASS | `npm audit --omit=dev --audit-level=high` exit `0`; không còn high/critical |
| Remaining advisories | TRACKED | 4 moderate thuộc `minio@8.0.7` và dependency con; audit chỉ đề xuất downgrade breaking về MinIO 7.1.3 |
| Server lint | PASS | `npm --prefix server run lint` |
| Server build | PASS | `npm --prefix server run build` |
| Server full tests | PASS | 20/20 suite, 166/166 test |
| Docker build | PASS | Image local `abslider-server:bcrypt6-gate`, ID `sha256:c5d57174a79af879b843ef416a7bd2ddb2d0c419389b10e4cd57090271af015c` |
| Docker native bcrypt | PASS | Runtime image load và thực thi `bcrypt@6.0.0` thành công |
| Docker runtime readiness | PASS | Container chạy user `abslider` và chuyển sang `healthy` |
| Authentication smoke | PASS | Đăng nhập admin đã seed trả HTTP `200`, `success=true` |
| SIGTERM shutdown | PASS | Container exit code `0` |
| Temporary resource cleanup | PASS | Không còn container hoặc network `abslider-bcrypt*` sau smoke test |

### File bị ảnh hưởng

- `server/package.json`
- `server/package-lock.json`
- `docs/devops-change-log.md`

### Trạng thái

| Mức | Trạng thái |
|---|---|
| Bcrypt upgrade | `TEST_PASS` — local only |
| High/critical production dependency gate | `TEST_PASS` |
| Moderate advisories | `TEST_PARTIAL` — đã ghi backlog, chưa có upgrade an toàn |
| Commit | `COMMITTED_LOCAL` — `5ed9b23f8e83a84f64a104b6d7826281bf26992b` |
| Push | `PUSHED` — local `HEAD` và `origin/developer` cùng trỏ tới `5ed9b23f8e83a84f64a104b6d7826281bf26992b` |
| CI/CD | Chưa triển khai |
| Production | Chưa deploy |

---

## 2026-09-13 — CI rehearsal trước khi tạo Jenkins pipeline

### Mục tiêu

Chạy thủ công đúng nhóm lệnh dự kiến đưa vào Jenkins từ một clean install, phân biệt quality gate chức năng với security gate và chỉ tạo pipeline khi các blocker mức cao đã được xử lý.

### Phạm vi kiểm tra

- Nhánh `developer` tại commit `e49d813d6b3638bafdd283b1bfa07bf0f06f99d8`.
- Client và server được chạy `npm ci` riêng bằng Node `24.21.0`, npm `11.19.0` theo `.nvmrc`.
- Chạy client lint/build; repository hiện chưa có client test script.
- Chạy server lint/build và toàn bộ Jest test, bao gồm Testcontainers integration test.
- Chạy production dependency audit ở ngưỡng `high`.
- Build backend Docker image và validate Docker Compose.

Shell tự động ban đầu dùng Node `24.18.0`, npm `11.16.0`, không khớp contract repository. Sau khi nạp `/home/duckcy/.nvm/nvm.sh` và chạy `nvm use`, toolchain đã khớp chính xác Node `24.21.0`, npm `11.19.0`. Jenkins agent sau này phải chủ động chọn toolchain, không dựa vào Node mặc định của shell.

### Bằng chứng kiểm tra

| Gate | Kết quả | Ghi chú |
|---|---|---|
| Git baseline | PASS | `HEAD` và `origin/developer` cùng ở `e49d813d6b3638bafdd283b1bfa07bf0f06f99d8` |
| Client clean install | PASS có cảnh báo | 252 package; 2 moderate vulnerabilities; npm 11 cảnh báo 2 install script chưa allowlist |
| Server clean install | PASS có cảnh báo | 897 package; Babel 8/Babel 7 peer warnings; 6 vulnerabilities; npm 11 cảnh báo 8 install script chưa allowlist |
| Client lint | PASS | `npm --prefix client run lint` |
| Client build/typecheck | PASS có cảnh báo | `tsc -b && vite build`; bundle chính 865.74 kB vượt ngưỡng cảnh báo 500 kB |
| Client tests | NOT_AVAILABLE | `client/package.json` chưa có test script |
| Server lint | PASS | `npm --prefix server run lint` |
| Server build | PASS | `npm --prefix server run build` |
| Server tests | PASS | 20/20 suite, 166/166 test |
| Client production audit, threshold high | PASS | Exit `0`; còn 2 moderate qua `react-router-dom@6.30.6` / `react-router@6.30.6` |
| Server production audit, threshold high | FAIL | Exit `1`; 4 moderate, 1 high, 1 critical |
| `npm audit fix --dry-run` | NO_CHANGE | Không có bản sửa tự động không-force cho client hoặc server |
| Backend Docker build | PASS | `abslider-server:ci-rehearsal`, image ID `sha256:4edcb6526a840c494c954a231352805ee2a83159e5cf6bf45d20591ab7a761fd` |
| Docker runtime metadata | PASS | User `abslider`; healthcheck gọi `/api/v1/health/ready` |
| Docker Compose config | PASS | `docker compose -f docker-compose.dev.yml config --quiet` với biến CI giả lập |
| Worktree after commands | PASS | `npm ci`, audit, build và test không thay đổi file tracked |

### Phân loại security findings

- Critical/high của server:
  - `bcrypt@5.1.1` → `@mapbox/node-pre-gyp@1.0.11` → `tar@6.2.1`.
  - Registry hiện có `bcrypt@6.0.0`, hỗ trợ Node `>=18` và thay `node-pre-gyp` bằng `node-gyp-build`; cần nâng riêng và chạy lại toàn bộ test/smoke.
- Moderate của server:
  - `minio@8.0.7` → `query-string@7.1.3` / `decode-uri-component@0.2.2` và `stream-json@1.9.1`.
  - `minio@8.0.7` đang là phiên bản mới nhất trên registry ở thời điểm kiểm tra; audit chỉ đề xuất downgrade major về `7.1.3`, nên không tự động áp dụng.
- Moderate của client:
  - `react-router-dom@6.30.6` → `react-router@6.30.6`.
  - Bản vá được audit đề xuất là `react-router-dom@7.18.3`, một major upgrade; cần migration/test riêng.

Không chạy `npm audit fix --force` và không downgrade MinIO chỉ để làm sạch báo cáo.

### Blocker và bước tiếp theo

1. Nâng `bcrypt` từ 5.1.1 lên 6.0.0 trong một commit riêng.
2. Chạy clean install, full backend tests, Docker build/runtime smoke và audit lại.
3. Chỉ khi server không còn high/critical mới tạo Jenkinsfile.
4. Lập backlog riêng cho client test, React Router major migration, MinIO advisory, bundle splitting và npm install-script policy.

### Trạng thái

| Mức | Trạng thái |
|---|---|
| Functional CI rehearsal | `TEST_PASS` |
| Security gate | `TEST_PARTIAL` — server high/critical còn tồn tại |
| Jenkins pipeline | `PLANNED` — chưa tạo |
| Commit | Chưa commit |
| Push | Chưa push |
| Production | Chưa deploy |

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
