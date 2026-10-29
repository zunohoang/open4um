# API and Selenium automation milestones

Target: hosted **develop**, `https://dev-slides.sbltcup.dev` and
`https://dev-slides-api.sbltcup.dev/api/v1`.

Branch: `test/api-selenium-uc032`, created from freshly fetched `origin/develop`
at `fdaa8c44933b3737c144a023b995de8f54848a05` on 2026-10-28.

| Milestone | Exit criterion | Status |
| --- | --- | --- |
| M1 — Baseline | Fresh develop branch; original dirty checkout preserved; route/field inventory read | Complete |
| M2 — Postman | Importable whole-backend collection, core/AI/email modes, fixture recovery, route coverage | Complete; 340 requests, all 45 routes represented, core 276/276 passed |
| M3 — Selenium | TC-73 and TC-74, 28 invalid variants plus correction, screenshots, original-config restoration | Complete; 30/30 scenarios passed; both cases PASSED |
| M4 — Verification | Offline checks, hosted core and browser runs, repeatability and cleanup evidence | Complete; public 12/12, core 276/276 twice, browser 30/30, offline 9/9; restoration verified |
| M5 — GitHub delivery | Sanitized source committed and pushed; reviewable PR and run guide | Ready for commit/push; verification and credential review complete |

TC-75 / TC-UC032-03 is excluded by request. Live AI and email tests are
separately launched integrations. No CI integration, product fixes, or automatic
Kiwi/Jira publication is included. Historical Kiwi statuses are not execution evidence.

The latest develop source contains all five Credit fields and a dashboard route.
This supersedes the older checkout mismatch discovered during planning.

See [verification evidence and limits](automation-verification.md) and
[setup/run/recovery instructions](automation-guide.md).
