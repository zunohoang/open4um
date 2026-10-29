# Execution evidence review ? 29 October 2026

## Findings and corrections

The reviewed screenshot implementation captured after state reset: 30 images
contained only two distinct pixel hashes. The API parser read an obsolete request
field and displayed invented GET defaults/empty URLs. Environment/browser labels
were hard-coded. These could make a polished report misrepresent execution.

Screenshots now occur at entered input, actual visible success/error feedback,
and refreshed persisted state. Required checkpoints are enforced. Checkpoint JSON
records expectations, observed input, HTTP transactions and independent API
readback. Raw screenshots are never annotated to manufacture application feedback.
Reports use real runtime metadata and distinguish partial, blocked, interrupted,
failed and complete runs. Cleanup failure prevents a green result.

API reports use the actual Postman CLI requestExecuted payload, exact method,
sanitized URL/bodies, status, latency and assertion outcomes. Stable request IDs
validate completeness even when Postman expands variables in request names.
Unknown metadata is an evidence failure, not a fabricated default.

## Verified execution

Target: hosted development. Existing original Credit configuration was restored
and read back after each authenticated run. No CI, Kiwi or Jira results were
published automatically.

| Run | Result | Evidence |
| --- | --- | --- |
| Selenium 422a0a7242d44f1c852e96c9115e2031 | 30/30 scenarios passed; TC-73 and TC-74 complete | 140 checkpoint PNGs, 71 distinct pixel hashes; visible success and validation feedback; persistence readback |
| Core API 4fbf8e86fcbe43258d68793e748b35aa | 276 requests and 827 assertions passed | GET 111, POST 56, PATCH 99, DELETE 10; cleanup verified |
| Diagnostic c8bfde90bafc488090f83f24effc7b71 | One intentionally failed harness check | Four screenshots including assertion failure; recovery verified; separate diagnostics directory |
| Offline reporter/recovery checks | 20 tests passed | Malformed/missing evidence, redaction, tampering, request identity, partial reporting and HTML escaping |

All three listed live run directories passed offline integrity verification.
Earlier failed/partial runs remain historical evidence and were not relabeled.
Live source copies and file hashes identify what actually executed, including
uncommitted changes; the eventual Git commit alone is not a substitute for those
snapshots. HTML search, screenshot zoom and Swagger rendering were checked in Chrome.

## Limits

TC-75 / UC032-03 remains excluded by the agreed scope. These runs do not establish
successful AI provider calls, email delivery, all browser support, production
behavior or an independently witnessed execution. Browser number inputs may block
letters: evidence records the value actually accepted rather than pretending the
literal requested text reached the server. Expected 4xx responses are successful
negative tests when assertions match. Exported storage objects have no deletion
API; the recovery journal reports any remaining paths.

Checksums expose changed artifacts when compared with the original manifest.
They are not cryptographic proof of who ran the tests or a trusted timestamp.
Keep the complete run directory, review personal data before sharing, and use
`tests/verify_evidence.py` to check it. A deliberate diagnostic failure is not a
product regression. Swagger deployment is a separate backend change.
