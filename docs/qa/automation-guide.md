# ABSlider QA: small API suite and Selenium

The default Postman suite covers **AI outline generation only**. Selenium keeps
its existing Credit configuration scope. Run the packages sequentially.

## Scope

| Tool | Feature scenarios |
| --- | --- |
| Postman | AI-OUTLINE-01: valid prompt returns a usable outline, charges the configured outline price, and persists the outline/balance |
| Postman | AI-OUTLINE-02: empty prompt returns HTTP 422 without consuming credits |
| Postman | AI-OUTLINE-03: unauthenticated request returns HTTP 401 |
| Selenium | TC-73 / UC032-01 and TC-74 / UC032-02: 30 scenarios covering valid Credit saves, invalid input, correction and persistence |

The outline endpoint accepts `prompt`, not a separate slide-count field. This
suite checks the returned structure rather than inventing an exact-count contract.
It does not establish semantic teaching quality, AI stability, full slide
generation, editing/chat, email, or UC032-03 coverage.

The small API collection has **15 HTTP requests supporting three feature
scenarios**: five setup requests, six scenario/readback requests and four cleanup
requests. Supporting requests are labeled in the report. It creates one disposable
user, makes at most one Gemini generation request, and does not retry it. This can
consume provider quota and the configured outline price from the fixture's test
credits. No global Credit configuration is written. The account is funded with
the current outline price plus 10 application credits and deleted afterward.

## Files

- Active collection: `tests/postman/outline/AI-Outline.postman_collection.json`
- Active environment template: `tests/postman/outline/Development.postman_environment.json`
- Readable generator/checker: `tests/postman/outline/generate.mjs` and `check.mjs`
- Runner: `tests/postman/run.py` (defaults to `outline`)
- Selenium: `tests/selenium/` (test scope unchanged)

The previous whole-backend collection stays at
`tests/postman/ABSlider.postman_collection.json`, unchanged. It is not invoked by
the default run or used to populate new outline results. Historical backend
reports remain intact. Its commands require an explicit legacy mode; see the
[optional backend guide](backend-regression-guide.md) only when resuming that work.

## One-time Windows setup

Run from the QA branch checkout root. Install Python 3.12, Chrome and the official
Postman CLI. Use the repository Node version for JavaScript tooling.

```powershell
py -3.12 -m venv tests/selenium/.venv
& ./tests/selenium/.venv/Scripts/python.exe -m pip install -r tests/selenium/requirements.txt
Copy-Item tests/selenium/.env.example tests/selenium/.env
npm.cmd install -g postman-cli@1.82.0
```

Put QA_ADMIN_EMAIL and QA_ADMIN_PASSWORD in that ignored `.env`, and set
`QA_ALLOW_MUTATIONS=true` to authorize disposable test fixtures. Never commit
credentials or populated Postman environments. If needed, set QA_POSTMAN_BINARY,
QA_CHROMEDRIVER or QA_CHROME_BINARY to local executables. Selenium Manager normally
resolves ChromeDriver automatically. A Postman cloud account is unnecessary.

Both packages target hosted development only:
`https://dev-slides.sbltcup.dev` and
`https://dev-slides-api.sbltcup.dev/api/v1`. The runner requires a develop release,
ready dependencies and a valid QA Admin for fixture creation/cleanup. Gemini
credentials/quota must be available on the backend. No local app or database is
needed. Avoid concurrent Admin Credit changes; the local lock cannot coordinate
other machines.

## Run and review

API (the new small suite is the default):

```powershell
& ./tests/selenium/.venv/Scripts/python.exe tests/postman/run.py
```

Selenium, after the API run finishes:

```powershell
& ./tests/selenium/.venv/Scripts/python.exe -m pytest tests/selenium --headless
```

Omit `--headless` to watch Chrome. Open
`tests/postman/reports/latest_report.html` and
`tests/selenium/reports/latest_report.html` afterward. The API report shows three
scenario outcomes plus the actual setup/scenario/cleanup HTTP records and
assertions. A provider error, invalid output, missing readback or unsuccessful
cleanup is not a pass. Failed/skipped/blocked requests are never replaced by mock
AI output. Source snapshots identify the files actually used for each run.

Selenium records raw screenshots of inputs, visible success/error feedback and
refreshed persistence, with browser HTTP transactions and independent API
readback. Partial selections cannot establish a complete case pass. The original
Credit configuration is restored after Selenium, even if different from its
80/10/5/5/100 test baseline.

Verify a saved run offline:

```powershell
& ./tests/selenium/.venv/Scripts/python.exe tests/verify_evidence.py tests/postman/reports/<run-id>
```

Share the entire run folder to include linked screenshots, source and checksums.
Review personal data first. Hashes detect changes against the original manifest;
they are not signatures or trusted timestamps. Reports, runtime secrets, browser
artifacts and `.venv` remain Git-ignored. No results are automatically published
to Kiwi, Jira or Postman cloud. Swagger explores APIs; it does not replace test
assertion evidence.

## Recovery

The Python runner journals exact fixture identities before creation and verifies
cleanup even after failed assertions. Admin deletion removes the fixture and its
owned lecture/usage records. If interrupted, inspect the run's recovery journal:

```powershell
& ./tests/selenium/.venv/Scripts/python.exe tests/qa_support.py --recover "tests/postman/reports/<run-id>/recovery.json"
```

A stale `tests/.qa-lock` should be removed only after confirming its PID has ended.
Never remove an active lock. Outline recovery deletes only the run-owned user;
it does not write global prices. Raw CLI JSON/private runtime environments are
removed on ordinary completion, but a hard kill can leave ignored private files.
Recover first and remove those private leftovers afterward.

## Postman desktop (optional)

Import only the two files in `tests/postman/outline/`. Fill Admin credentials in a
private local environment and set `allowMutations` to `true`; keep `runMode=outline`.
Run the entire collection once, not isolated scenario folders: setup creates the
fixture and cleanup deletes it. The Python runner is preferred for journaled
recovery. For an interrupted desktop run, privately export the environment to an
ignored `.local.json` file and use `tests/qa_support.py --postman-environment <file>`.
Never share that populated export. Do not rerun setup while a run is unfinished.

## Offline maintenance

```powershell
node tests/postman/outline/generate.mjs
node tests/postman/outline/check.mjs
& ./tests/selenium/.venv/Scripts/python.exe -m unittest discover -s tests -p 'test_*.py' -q
```

The checker validates the reduced scope, compiles scripts, rejects retry loops and
configuration writes, and checks the sanitized environment. Offline checks are
not live acceptance results. [Earlier evidence review](evidence-review.md) records
the broader historical runs; it is not evidence for the new outline suite.

To check screenshot failure capture intentionally, separately run
`python -m pytest tests/selenium/evidence_canary.py --headless --evidence-diagnostic`
with the QA venv. It deliberately exits 1, restores configuration, and writes under
`reports/diagnostics/` without replacing the main Selenium report. It is a harness
check, not a product defect or Kiwi execution.

See [the outline verification record](outline-verification.md) for the new suite's live result and its limits.
