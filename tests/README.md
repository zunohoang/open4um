# ABSlider development QA

Start with [setup, execution and recovery](../docs/qa/automation-guide.md).
Recorded live results and limitations are in
[the verification summary](../docs/qa/automation-verification.md).

- `postman/`: whole-backend API collection; core, public, AI and staged email modes.
- `selenium/`: TC-73 / UC032-01 and TC-74 / UC032-02 (30 pytest scenarios).
- `qa_support.py`: development-only preflight, fixture journal and recovery.
- `test_harness.py`: offline checks for reports and recovery.

TC-75 / UC032-03 and CI integration are excluded. Generated reports and local
credentials are ignored by Git. Authored coverage is not execution evidence.
