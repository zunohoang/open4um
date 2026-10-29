# ABSlider QA

Use [setup and execution](../docs/qa/automation-guide.md).

- **Default API:** `postman/outline/AI-Outline.postman_collection.json` contains
  three AI outline scenarios with 15 supporting HTTP requests. Run
  `python tests/postman/run.py` using the QA venv. At most one Gemini request.
- **Selenium:** `selenium/` keeps TC-73 / UC032-01 and TC-74 / UC032-02,
  totaling 30 pytest scenarios. UC032-03 remains excluded.
- **Retained, unused backend collection:** `postman/ABSlider.postman_collection.json`.
  It is unchanged and only runs with an explicit `--mode core`, `--mode public`
  or `--mode ai`. See the optional backend guide before resuming it.

Open `postman/reports/latest_report.html` or
`selenium/reports/latest_report.html` after execution. Reports distinguish feature
scenarios from supporting requests. Verify a whole run directory with
`python tests/verify_evidence.py <run-directory>` using the QA venv.

Credentials and generated artifacts are ignored by Git. Authored tests are not
passing execution evidence. No CI or automatic Kiwi/Jira publication is added.

[New outline execution record](../docs/qa/outline-verification.md): three scenarios,
15 requests and 48 assertions passed on hosted development.
