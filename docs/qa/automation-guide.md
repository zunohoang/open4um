# ABSlider Postman and Selenium QA

These packages run **locally** against hosted development. No local MongoDB,
Redis, MinIO, backend, or frontend is needed. The existing Jest suites remain
unchanged. GitHub stores the test source; no CI workflow is added (the project
uses Jenkins).

## Contents and target

| Location | Purpose |
| --- | --- |
| `tests/postman/ABSlider.postman_collection.json` | Importable Postman v2.1 collection covering all backend route families |
| `tests/postman/Development.postman_environment.json` | Environment template, without credentials |
| `tests/postman/generate.mjs` | Readable source for requests, data and assertions |
| `tests/postman/run.py` | Local Postman CLI execution, sanitized reports and recovery |
| `tests/postman/route-coverage.md` | Route-to-request mapping; authored coverage, not execution evidence |
| `tests/selenium/` | Python/pytest/Selenium page objects and UC032 tests |
| `tests/qa_support.py` | Shared preflight, run lock, snapshot and recovery tools |
| `tests/test_harness.py` | Offline checks for recovery safeguards and honest reporting |
| `docs/qa/automation-milestones.md` | Delivery milestones |

- Website: `https://dev-slides.sbltcup.dev`
- API: `https://dev-slides-api.sbltcup.dev/api/v1`
- The runners and collection refuse a different API base. The authenticated
  runners also require the release to identify itself as `develop`.
- Current field contract: `pricePerLecture`, `pricePerSlide`, `pricePerAiEdit`,
  `pricePerOutline`, `signupBonus`.
- TC-73 / TC-UC032-01 and TC-74 / TC-UC032-02 use the Sprint 4 definitions.
  The older TC-40 mapping is not used. TC-75 / TC-UC032-03 is explicitly excluded.

## One-time Windows setup

Run from the **test branch checkout root**. Install Python 3.12 and Chrome if they
are not already available. Commands use the venv executable directly, so changing
PowerShell's execution policy or activating a script is unnecessary.

```powershell
py -3.12 -m venv tests/selenium/.venv
& ./tests/selenium/.venv/Scripts/python.exe -m pip install -r tests/selenium/requirements.txt
Copy-Item tests/selenium/.env.example tests/selenium/.env
```

If Python is installed but `py` is unavailable, use its full executable path in
the first command. On Linux, use `python3.12 -m venv ...` and `.venv/bin/python`.

Edit the ignored `tests/selenium/.env` locally:

```dotenv
QA_ADMIN_EMAIL=<development QA admin email>
QA_ADMIN_PASSWORD=<development QA admin password>
QA_ALLOW_MUTATIONS=true
```

Only enable mutations during an **exclusive Credit-configuration QA window**.
Both suites modify global development prices temporarily. The shared local lock
prevents overlapping runs in this checkout, but cannot prevent another Admin or
a different machine from changing the server. Keep both suites sequential.

Selenium Manager resolves ChromeDriver automatically. If a proxy or offline
environment prevents this, supply the matching executable via `QA_CHROMEDRIVER`.
`QA_CHROME_BINARY` can point to a non-default Chrome installation.

For local collection execution, install the official Postman CLI:

```powershell
npm.cmd install -g postman-cli@1.82.0
postman --version
```

Alternatively set `QA_POSTMAN_BINARY` to an existing `postman.exe` or
`postman.cmd`. Node is only needed for npm installation and collection
regeneration, not Selenium or Postman desktop. Use the repository's `.nvmrc`
version for project Node work; do not modify the server/client dependency locks.

We use the v2.1 JSON collection and local JSON reporter. A Postman cloud account
is unnecessary for these runs; cloud event reporting is disabled. Do not use
`--output`, cloud collection IDs or `postman login` to run this package.
The CLI may print a sign-in reminder even though a local run succeeds.

## Recommended execution sequence

### 1. Public API smoke — no credentials or application writes

```powershell
& ./tests/selenium/.venv/Scripts/python.exe tests/postman/run.py --mode public
```

Checks health/version and unauthenticated rejection. It is not proof that
authenticated CRUD, Credit configuration or AI work.

### 2. Core API tests

```powershell
& ./tests/selenium/.venv/Scripts/python.exe tests/postman/run.py --mode core
```

The run logs in as the configured Admin, snapshots all five Credit settings and
creates three uniquely named disposable users. It covers authentication/profile,
roles and ownership, Admin user operations, folders, blank lectures, slide
operations, autosave, trash/restore/delete, presentation/export, Credit updates,
AI request rejection without provider calls, usage/date validation and dashboard
contract checks. It then restores the original configuration and deletes only
the recorded fixtures. No email or successful AI request is part of this mode.

Positive export checks can create a JSON object in development storage. If a URL
is returned, the collection downloads it and compares the exported lecture. The
API has no storage-object deletion endpoint; the sanitized recovery report lists
remaining object paths for the storage owner. Database fixture cleanup does not
claim to remove these objects. The documented inline-data fallback is accepted
when `downloadUrl` is null. PDF rendering belongs to the frontend and is excluded.

### 3. Selenium Credit cases

```powershell
& ./tests/selenium/.venv/Scripts/python.exe -m pytest tests/selenium --junitxml=tests/selenium/reports/junit.xml
```

Chrome is visible by default. Add `--headless` for an unattended run. Select a
case with `-m uc032_01` or `-m uc032_02`. Each scenario gets a fresh browser and
baseline; it does not depend on another scenario passing.

| Case | Executed scenarios |
| --- | --- |
| TC-73 / TC-UC032-01 | Baseline `80/10/5/5/100`; save Chat-slide `7`, edit `3`, lecture `81`, outline `6`, then Chat-slide `1`. Refresh and compare all fields after each save. Restore baseline through the UI. |
| TC-74 / TC-UC032-02 | Four AI cost fields × `0`, `-1`, `1.5`, `abc`, `5abc`, empty string and whitespace = 28 independent variants. Verify rejection, explanatory error, no false success and no persisted invalid values. |
| TC-74 correction | Chat-slide `6` + edit `0` must not partially save; correct edit to `6`, save and verify `80/6/6/5/100`, then restore the baseline through the UI. |

There are **30 pytest scenarios**, aggregated into **two Kiwi cases**. Selecting
only part of a case reports partial coverage, never a full case pass. The original
pre-run server configuration is restored after the suite, even if it differed
from the documented case baseline. Failure screenshots and observed typed values
support diagnosis; browser actions remain Selenium actions, not API substitutes.

### 4. Real AI — separate, explicit launch

```powershell
& ./tests/selenium/.venv/Scripts/python.exe tests/postman/run.py --mode ai
```

This makes four successful-provider attempts: outline, full lecture, single-slide
edit and Chat edit. Each call checks its result, expected price, persisted balance
and the corresponding usage record. Fixtures receive 1,000 application credits;
the server still requires a working Gemini key/quota. There are no automatic
provider retries. Unexpected AI actions or unavailable providers are reported,
not converted into passes. This does not exercise TC-75's cross-session price
change scenario. Run this only when intending to use the provider.

## Using Postman desktop and email/OTP tests

1. Import the collection and environment JSON files. Use a private/local
   environment and fill `adminEmail`/`adminPassword` locally.
2. Set `runMode` to `core`, `public`, `ai` or `email`. For writes, set
   `allowMutations` to the string `true` during the exclusive QA window.
3. Run **one top-level folder**, not the entire collection. Core and AI folders
   include their own Setup and Cleanup. The Python runner is recommended because
   it journals recovery before sending mutations.
4. For email tests, use a **controlled, unused test mailbox** in `mailbox` and
   set `runMode=email`. The flow registers and later deletes that test account.
5. Run `Email 1 - Request registration OTP`; check the mailbox yourself.
6. Enter the received six-digit code as `registrationOtp`, then run
   `Email 2 - Register with received OTP` before the code expires.
7. Run `Email 3 - Request password reset`; enter the new code as `resetOtp`.
8. Run `Email 4 - Reset password and cleanup`. It checks old/new login behavior
   and deletes only the registered fixture. Preserve the same local environment
   between stages. Do not rerun stage 1 to resume a later stage.

Successful email delivery and OTP use are manual integration evidence. Schema
rejections in Core do not establish that email was delivered. No mailbox scraping
or verification bypass is implemented. Never commit a populated environment
export; it may contain passwords, bearer tokens and OTPs.

## Reports, interruption and recovery

- Postman: `tests/postman/reports/<run-id>/report.html`, `summary.json`, `junit.xml`.
  The summary points to the separate recovery journal when writes occurred.
- Selenium: `tests/selenium/reports/<run-id>/report.html`, `summary.json`, failure
  PNGs, and the requested JUnit output. Reports contain timestamps and the
  authenticated run journal records the deployment SHA.
- `PASSED` means all required checks executed and passed. `FAILED` means an
  assertion or cleanup failed. `BLOCKED` means missing credentials, unavailable
  dependencies or browser setup prevented execution. Excluded AI/email folders
  remain unexecuted until separately launched. Product failures are not silently
  marked xfail or patched by this QA change.
- Runner exit codes: `0` complete/pass, `1` failure, `2` blocked for Postman;
  pytest uses its standard failure/error codes and returns nonzero for blocked
  scenarios. `--collect-only` is discovery, not execution evidence.
- Raw CLI reports and runtime credential files are removed by the runner on
  normal completion/failure; all report folders are Git-ignored. A hard process
  kill can leave private runtime files in that ignored directory. Remove those
  private files after recovering the run.

Recover an interrupted CLI/Selenium run with its exact journal:

```powershell
& ./tests/selenium/.venv/Scripts/python.exe tests/qa_support.py --recover "tests/postman/reports/<run-id>/recovery.json"
```

If `.qa-lock` remains after a hard kill, inspect its PID and confirm the process
has ended, then remove that single lock file before recovery. Never remove an
active run's lock. Recovery verifies configuration readback and exact fixture
identities, refuses other environments, and can be repeated safely.

For an interrupted **Postman desktop** run, export its private environment to an
ignored `*.local.json` file and recover with:

```powershell
& ./tests/selenium/.venv/Scripts/python.exe tests/qa_support.py --postman-environment "tests/postman/interrupted.local.json"
```

Keep the original environment until recovery succeeds, then remove the private
export. Email recovery identifies the exact recorded mailbox account ID and QA
name; it never deletes an existing unrelated mailbox account. Unsuccessful
cleanup is a failure, not a green run.

## Maintaining and reviewing the packages

```powershell
node tests/postman/generate.mjs
node tests/postman/check.mjs
& ./tests/selenium/.venv/Scripts/python.exe -m unittest discover -s tests -p test_harness.py -v
& ./tests/selenium/.venv/Scripts/python.exe -m pytest tests/selenium --collect-only -q
```

The checker compiles every generated JavaScript script and maps every current
backend route to request IDs. The offline Python tests verify failure accounting,
secret omission and recovery boundaries; they are not server acceptance tests.

Commit the source, sanitized templates, coverage map and docs on
`test/api-selenium-uc032`; review through a PR into `develop`. Do not commit `.env`,
runtime exports, tokens, `.venv`, browser caches, screenshots or raw reports.
The source code does not automatically publish results to Kiwi/Jira or Postman
cloud. If attaching selected evidence manually, review it for user data first.

References: [Selenium waits](https://www.selenium.dev/documentation/webdriver/waits/),
[Selenium Manager](https://www.selenium.dev/documentation/selenium_manager/),
[Postman scripts](https://learning.postman.com/docs/tests-and-scripts/write-scripts/test-scripts/),
[Postman CLI installation](https://learning.postman.com/docs/postman-cli/postman-cli-installation/),
[local report options](https://learning.postman.com/docs/postman-cli/postman-cli-reporters/).
