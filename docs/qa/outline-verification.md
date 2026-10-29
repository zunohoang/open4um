# Small AI outline suite: verified execution

On 29 October 2026, run `643604ab509e4faba7cb0a064eed4b79` executed the new
standalone outline collection against hosted development. This was a real Gemini
generation, not a mocked or replayed response.

| Scenario | Observed result |
| --- | --- |
| AI-OUTLINE-01 | HTTP 200; nonempty outline title/sections with headings and bullet arrays; configured charge returned; independent balance and saved-outline reads matched |
| AI-OUTLINE-02 | Empty prompt returned HTTP 422 with an error message; fixture balance unchanged after rejected requests |
| AI-OUTLINE-03 | A valid prompt without authentication returned HTTP 401 with an error message |

All **15 HTTP requests and 48 assertions passed**. Five setup requests and four
cleanup requests support the feature scenarios. Six requests execute scenarios
and independent readback. Exactly one authenticated valid generation request was
made; no provider retry occurred. The configured outline price was 5 application
credits; the disposable user started with 15 and had 10 after generation.

Cleanup was independently verified. The fixture was absent from Admin lookup;
Admin deletion cascades owned lecture and usage records in the implementation.
The runner additionally reconciled the exact fixture identity. Global Credit
configuration was read before/after and remained 80/10/5/5/100; neither the suite
nor its recovery writes those settings.

The run directory contains sanitized transactions/responses, exact collection
source copies, source hashes, deployment revision, JUnit and integrity manifest.
Its recorded deployment revision is
`fdaa8c44933b3737c144a023b995de8f54848a05`. The run used working changes based
on QA commit `47d5146`; source copies establish what executed. A later runner
adjustment moves the initial read-only Credit snapshot before recovery-journal
creation so a failed initial read cannot leave an incomplete journal.

Offline integrity verification and credential scanning passed. All 24 offline
evidence/recovery tests passed. Chrome rendered all three passed scenario labels
and 15 transactions, filtered the positive scenario to its three relevant
transactions, and reported no JavaScript errors. The standalone checker compiled
31 scripts and verified scope boundaries without contacting the application.

Historical whole-backend runs remain separate historical evidence. That collection
was not executed for this change. Selenium test files were not changed or rerun;
the earlier 30-scenario result remains the previous execution record.

The suite validates response shape, error handling, persistence and billing for
this outline endpoint. It does not prove teaching quality, an exact section count,
full slide generation, email delivery, AI editing/chat, or repeated-run stability.
Hashes detect artifact changes; they are not signatures or trusted timestamps.
Generated reports remain ignored by Git.
