# Postman suites

`python tests/postman/run.py` now defaults to **outline**, using only
`outline/AI-Outline.postman_collection.json`. Import its matching environment
from `outline/` for Postman desktop. See [the main guide](../../docs/qa/automation-guide.md).

The original `ABSlider.postman_collection.json`, `generate.mjs`, `check.mjs`,
`coverage.json`, environment and data remain unchanged. They are retained for
optional backend regression and are not used by the default suite. Explicit
legacy modes are documented in [the backend guide](../../docs/qa/backend-regression-guide.md).
Historical full-backend reports remain historical; they do not prove this new
small suite passed.
