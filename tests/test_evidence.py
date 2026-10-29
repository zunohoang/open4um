"""Adversarial offline checks for truthful reports and artifact integrity."""
import json
import tempfile
import unittest
from pathlib import Path
from xml.etree import ElementTree as ET

from evidence_support import safe_data, safe_url, seal, verify, write_junit
from qa_support import write_json
from reporting import render, publish
from test_harness import runner


class HttpEvidenceTests(unittest.TestCase):
    def test_plan_uses_stable_ids_when_postman_expands_display_names(self):
        planned = [{"id": "one", "name": "Request /{{lectureId}}"}, {"id": "two", "name": "Other"}]
        actual = [{"id": "one", "name": "Request /123"}, {"id": "two", "name": "Other"}]
        self.assertTrue(runner.plan_matches(planned, actual))
        self.assertFalse(runner.plan_matches(planned, [actual[0], actual[0]]))
        self.assertFalse(runner.plan_matches(planned, [{"name": "Request /123"}, actual[1]]))

    def test_actual_cli_metadata_preserves_patch_and_non_secret_filters(self):
        url = {"protocol": "https", "host": ["dev-slides-api", "sbltcup", "dev"],
               "path": ["api", "v1", "admin", "credit-config"],
               "query": [{"key": "page", "value": "2"}, {"key": "accessToken", "value": "TOP_SECRET"}]}
        raw = {"run": {"executions": [{"requestExecuted": {"name": "API-137 example", "method": "PATCH", "url": url},
            "tests": [{"name": "Expected HTTP", "status": "passed"}], "response": {"code": 422, "responseTime": 7}}]}}
        rows, _, _ = runner.sanitized_results(raw)
        self.assertEqual(rows[0]["method"], "PATCH")
        self.assertIn("page=2", rows[0]["endpoint"])
        self.assertNotIn("TOP_SECRET", json.dumps(rows))
        self.assertEqual(rows[0]["status"], "PASSED")  # 4xx can be an expected pass.

    def test_unexpected_200_with_failed_assertion_is_failed(self):
        raw = {"run": {"executions": [{"requestExecuted": {"name": "Unexpected success", "method": "DELETE", "url": "https://api.example/users/1"},
            "tests": [{"name": "Must reject", "status": "failed"}], "response": {"code": 200}}]}}
        rows, _, _ = runner.sanitized_results(raw)
        self.assertEqual(rows[0]["status"], "FAILED")
        self.assertIsNone(rows[0]["responseMs"])

    def test_missing_method_is_not_invented_as_get(self):
        raw = {"run": {"executions": [{"requestExecuted": {"name": "Missing evidence"},
            "tests": [{"name": "ok", "status": "passed"}], "response": {"code": 200}}]}}
        rows, _, _ = runner.sanitized_results(raw)
        self.assertEqual(rows[0]["method"], "UNKNOWN")
        self.assertEqual(rows[0]["status"], "FAILED")

    def test_nested_credentials_are_redacted(self):
        data = {"accessToken": "TOP_SECRET", "nested": {"password": "TOP_SECRET", "email": "private@example.org"},
                "link": "https://media.example/object?X-Amz-Signature=TOP_SECRET&part=2"}
        result = json.dumps(safe_data(data))
        self.assertNotIn("TOP_SECRET", result)
        self.assertNotIn("private@example.org", result)
        self.assertIn("part=2", result)


class ArtifactTests(unittest.TestCase):
    def test_modification_and_missing_files_are_detected(self):
        with tempfile.TemporaryDirectory() as name:
            directory = Path(name)
            write_json(directory / "summary.json", {"tests": []})
            (directory / "report.html").write_text("Offline unit fixture", encoding="utf-8")
            (directory / "junit.xml").write_text("<testsuite/>", encoding="utf-8")
            (directory / "capture.txt").write_text("unit fixture", encoding="utf-8")
            seal(directory)
            self.assertEqual(verify(directory), [])
            (directory / "capture.txt").write_text("changed", encoding="utf-8")
            self.assertTrue(any("Changed" in e for e in verify(directory)))
            (directory / "capture.txt").unlink()
            self.assertTrue(any("Missing" in e for e in verify(directory)))

    def test_manifest_cannot_point_outside_run(self):
        with tempfile.TemporaryDirectory() as name:
            directory = Path(name)
            write_json(directory / "summary.json", {"tests": []})
            write_json(directory / "integrity.json", {"files": [{"path": "../outside.txt", "bytes": 0, "sha256": "x"}]})
            self.assertTrue(verify(directory))

    def test_cleanup_error_is_in_junit_even_when_a_request_also_failed(self):
        with tempfile.TemporaryDirectory() as name:
            directory = Path(name)
            write_junit(directory, "Fixture", [{"name": "Bad request", "status": "FAILED"}], ["Cleanup failed"])
            root = ET.parse(directory / "junit.xml").getroot()
            self.assertEqual(root.attrib["failures"], "1")
            self.assertEqual(root.attrib["errors"], "1")


class DashboardTests(unittest.TestCase):
    def test_payload_placeholder_text_does_not_break_generated_json(self):
        rendered = render({"runId": "unit", "status": "BLOCKED", "reason": "__PREFIX__"}, "run/")
        self.assertIn('"reason": "__PREFIX__"', rendered)

    def test_partial_run_and_payload_cannot_masquerade_as_success_or_inject_script(self):
        summary = {"kind": "selenium", "runId": "unit-fixture", "status": "PARTIAL", "tests": [],
                   "target": "https://development.example", "reason": "</script><script>BAD_PAYLOAD</script>"}
        html = render(summary)
        self.assertNotIn("</script><script>BAD_PAYLOAD", html)
        self.assertIn('"status": "PARTIAL"', html)
        self.assertNotIn("Chrome 140", html)
        self.assertNotIn("http://localhost", html)

    def test_latest_pointer_changes_to_running_instead_of_old_pass(self):
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            publish(root / "old", {"runId": "old", "status": "PASSED"})
            publish(root / "new", {"runId": "new", "status": "RUNNING"})
            latest = json.loads((root / "latest.json").read_text(encoding="utf-8"))
            self.assertEqual(latest["runId"], "new")
            self.assertEqual(latest["status"], "RUNNING")


if __name__ == "__main__":
    unittest.main()
