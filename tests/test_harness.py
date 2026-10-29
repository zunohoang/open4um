"""Offline checks for failure reporting and safe recovery, not application tests."""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock

from qa_support import ALLOWED_API, BASELINE, recover, write_json, import_postman_recovery

spec = importlib.util.spec_from_file_location("postman_runner", Path(__file__).parent / "postman/run.py")
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class ReportTests(unittest.TestCase):
    def execution(self, tests, errors=None):
        return {"requestExecuted": {"name": "API-001 example", "headers": [{"value": "TOP_SECRET"}]},
                "response": {"code": 200, "responseTime": 1}, "tests": tests, "errors": errors or []}

    def test_failed_and_skipped_assertions_are_not_passes(self):
        for status in ("failed", "skipped"):
            rows, _, _ = runner.sanitized_results({"run": {"executions": [self.execution([{"name": "contract", "status": status}])]}})
            self.assertEqual(rows[0]["status"], "FAILED")

    def test_no_assertions_and_script_errors_fail(self):
        for execution in [self.execution([]), self.execution([{"name": "ok", "status": "passed"}], ["script failed"])]:
            rows, _, _ = runner.sanitized_results({"run": {"executions": [execution]}})
            self.assertEqual(rows[0]["status"], "FAILED")

    def test_secrets_and_signed_query_not_copied_to_report(self):
        execution = self.execution([{"name": "ok", "status": "passed"}])
        execution["response"]["stream"] = {"data": list(json.dumps({"data": {
            "downloadUrl": "https://media.example/exports/run/file.json?token=TOP_SECRET"}}).encode())}
        rows, objects, _ = runner.sanitized_results({"run": {"executions": [execution]}})
        self.assertEqual(rows[0]["status"], "PASSED")
        self.assertEqual(objects, ["/exports/run/file.json"])
        self.assertNotIn("TOP_SECRET", json.dumps([rows, objects]))

    def test_creation_inventory_excludes_other_accounts(self):
        run_id = "a" * 32
        email = f"qa-{run_id}-a@example.com"
        payloads = [
            {"_id": "owned-user", "email": email, "name": f"QA-{run_id}-A", "role": "user"},
            {"_id": "other-user", "email": "unrelated@example.com", "name": "Unrelated", "role": "user"},
            {"_id": "owned-lecture", "userId": "owned-user", "slides": []},
            {"_id": "other-lecture", "userId": "other-user", "slides": []},
            {"_id": "owned-folder", "userId": "owned-user", "name": "Folder"},
        ]
        raw = {"run": {"executions": [{"response": {"code": 201, "stream": {
            "data": list(json.dumps({"data": data}).encode())}}} for data in payloads]}}
        result = runner.created_resource_ids(raw, {"runId": run_id, "fixtureEmails": [email]})
        self.assertEqual(result, {"users": ["owned-user"], "lectures": ["owned-lecture"], "folders": ["owned-folder"]})


class RecoveryTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / "recovery.json"
        self.api = Mock(config={"api": ALLOWED_API})
        self.run_id = "a" * 32
        self.email = f"qa-{self.run_id}-a@example.com"
        self.manifest = {"schema": 1, "api": ALLOWED_API, "runId": self.run_id,
                         "originalConfig": BASELINE, "fixtureEmails": [self.email],
                         "fixtureIds": [], "cleanup": "pending"}

    def tearDown(self):
        self.tmp.cleanup()

    def test_exact_fixture_deleted_and_config_restored(self):
        fixture = {"_id": "id1", "email": self.email, "role": "user", "name": f"QA-{self.run_id}-A"}
        self.api.request.side_effect = [{"items": [fixture]}, {}, {"items": []}]
        write_json(self.path, self.manifest)
        result = recover(self.api, self.path)
        self.assertEqual(result["cleanup"], "complete")
        self.api.set_credit.assert_called_once_with(BASELINE)
        self.api.request.assert_any_call("DELETE", "/admin/users/id1")

    def test_foreign_user_is_never_deleted(self):
        fixture = {"_id": "id1", "email": self.email, "role": "user", "name": "Someone else's account"}
        self.api.request.return_value = {"items": [fixture]}
        write_json(self.path, self.manifest)
        with self.assertRaisesRegex(AssertionError, "Recovery incomplete"):
            recover(self.api, self.path)
        self.assertFalse(any(call.args[0] == "DELETE" for call in self.api.request.call_args_list))

    def test_other_environment_refused_before_mutation(self):
        self.manifest["api"] = "https://production.invalid/api/v1"
        write_json(self.path, self.manifest)
        with self.assertRaises(ValueError):
            recover(self.api, self.path)
        self.api.set_credit.assert_not_called()
        self.api.request.assert_not_called()

    def test_configuration_failure_does_not_prevent_fixture_cleanup(self):
        self.api.set_credit.side_effect = AssertionError("restore unavailable")
        self.api.request.return_value = {"items": []}
        write_json(self.path, self.manifest)
        with self.assertRaisesRegex(AssertionError, "restore unavailable"):
            recover(self.api, self.path)
        self.assertEqual(self.api.request.call_count, 2)
        self.assertEqual(json.loads(self.path.read_text())["cleanup"], "failed")

    def test_private_postman_export_import_drops_secrets(self):
        source = Path(self.tmp.name) / "environment.local.json"
        values = {"baseUrl": ALLOWED_API, "runId": self.run_id, "runMode": "core",
                  "originalConfig": json.dumps(BASELINE), "adminPassword": "TOP_SECRET", "adminToken": "TOP_SECRET"}
        write_json(source, {"values": [{"key": key, "value": value} for key, value in values.items()]})
        import_postman_recovery(source, self.path)
        self.assertNotIn("TOP_SECRET", self.path.read_text())


if __name__ == "__main__":
    unittest.main()
