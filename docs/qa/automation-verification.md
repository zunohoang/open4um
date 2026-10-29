# API and Selenium verification — 2026-10-29

Verified against hosted development release
`fdaa8c44933b3737c144a023b995de8f54848a05`. The test branch was created from
freshly fetched `origin/develop`; a final fetch confirmed the same base.

| Check | Actual result |
| --- | --- |
| Postman public smoke | 12/12 requests, 36/36 assertions passed |
| Postman Core — first run | 276/276 requests, 827/827 assertions passed |
| Selenium | 30/30 scenarios passed in 280.27 seconds; TC-73 and TC-74 both PASSED |
| Postman Core — repeat after Selenium | 276/276 requests, 827/827 assertions passed |
| Offline recovery/report checks | 9/9 passed |
| Collection structure | 340 requests; 688 generated scripts compiled; all 45 current backend routes represented |
| Python source compilation | All nine Python source files compiled |
| Credential/artifact review | Actual QA credentials absent from staged source; `.env`, reports, virtual environments and runtime files excluded |

The public and first Core runs occurred on 2026-10-28 (Asia/Saigon). Selenium,
repeat Core and the final restoration audit completed on 2026-10-29. Tooling:
Python 3.12.16, pytest 8.4.2, Selenium 4.38.0 and Postman CLI 1.82.0 on Windows.

## What the live checks prove

- Core exercises authenticated backend workflows, authorization and ownership,
  validation, persistence and cleanup. The full list is in
  [the route coverage map](../../tests/postman/route-coverage.md).
- TC-73 verifies all five Credit fields, each specified valid change and the
  lower boundary `1`, including success feedback and persistence after refresh.
- TC-74 verifies all 28 field/value combinations and the mixed-invalidity then
  correction scenario. None was skipped or marked expected-failure.
- The repeat Core run recorded three disposable user IDs, three lecture IDs and
  one folder ID. Its fixture cleanup and original-configuration readback passed.
- Final independent API readback confirmed `80 / 10 / 5 / 5 / 100`, matching the
  recorded original configuration. The shared QA lock was released.
- An earlier interrupted Selenium process was confirmed ended, and its recovery
  journal was successfully restored before the complete run began.

## Evidence locations on the execution machine

Generated reports remain local and Git-ignored. These relative paths are under
the QA branch checkout, not files published in this repository:

- Public: `tests/postman/reports/cf834efdf37b4e75be6d6696fa43807a/summary.json`
- First Core: `tests/postman/reports/ac82fefa5ab64b5b930ff770bce5d8f7/summary.json`
- Selenium: `tests/selenium/reports/8ed07a096b9143fb814ffccf7908f317/summary.json`
- Repeat Core: `tests/postman/reports/bc27ad9d82a140a0a0db50198429d97b/summary.json`

Each completed run also has a readable HTML report. API runs have sanitized JUnit
reports; Selenium JUnit is `tests/selenium/reports/junit.xml`. Configuration and
fixture recovery are recorded in the corresponding `recovery.json` journals.

## Execution limits

- Successful AI-provider and email/OTP folders are prepared for separate explicit
  execution. They were not run during this verification. Core's AI rejection
  checks do not establish provider availability or successful email delivery.
- TC-75 / TC-UC032-03, CI integration and automatic Kiwi/Jira publication are
  excluded by the agreed scope.
- Each Core run created one JSON export in development object storage. The API
  has no object-delete endpoint. The two object paths remain recorded in the
  recovery journals for storage-owner cleanup; database/configuration cleanup
  does not claim to delete those export objects.
- Dashboard API tests cover contracts and date validation, including a known
  empty range. They do not constitute a full independent statistics audit or a
  visual chart assessment.

See [the run guide](automation-guide.md) for repeating the checks and recovering
an interrupted run. These are newly executed results, not inherited Kiwi status.
