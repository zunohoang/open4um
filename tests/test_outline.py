"""Protect reduced-scope execution and recovery against accidental broad runs."""
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock

from qa_support import ALLOWED_API, new_manifest, import_postman_recovery, recover, write_json
from test_harness import runner


class OutlineTests(unittest.TestCase):
    def test_default_uses_separate_small_collection_and_broad_requires_explicit_mode(self):
        self.assertEqual(runner.parse_args([]).mode, "outline")
        path, inventory = runner.suite_paths(runner.parse_args([]).mode)
        self.assertEqual(path.parent.name, "outline")
        rows = json.loads(inventory.read_text(encoding="utf-8"))
        self.assertEqual(len(rows), 15)
        self.assertEqual(len([r for r in rows if r["route"] == "/lectures/generate-outline" and r["status"] == 200]), 1)
        self.assertEqual(runner.suite_paths(runner.parse_args(["--mode", "core"]).mode)[0].name, "ABSlider.postman_collection.json")

    def test_scenario_does_not_pass_if_readback_missing_or_failed(self):
        inventory = [{"scenario": "outline", "itemId": "generation"}, {"scenario": "outline", "itemId": "readback"}]
        self.assertEqual(runner.scenario_results(inventory, [{"id": "generation", "status": "PASSED"}]), {"outline": "NOT_RUN"})
        self.assertEqual(runner.scenario_results(inventory, [{"id": "generation", "status": "PASSED"}, {"id": "readback", "status": "FAILED"}]), {"outline": "FAILED"})

    def test_outline_recovery_deletes_exact_fixture_without_restoring_global_config(self):
        with tempfile.TemporaryDirectory() as temp:
            api = Mock(config={"api": ALLOWED_API})
            path, manifest = new_manifest(api, Path(temp), "postman-outline", restore_config=False, fixture_letters="a")
            self.assertEqual(len(manifest["fixtureEmails"]), 1)
            self.assertIsNone(manifest["originalConfig"])
            api.credit.assert_not_called()
            fixture = {"_id": "fixture", "email": manifest["fixtureEmails"][0], "role": "user", "name": "QA-"+manifest["runId"]+"-A"}
            api.request.side_effect = [{"items": [fixture]}, {}, {"items": []}]
            self.assertEqual(recover(api, path)["cleanup"], "complete")
            api.set_credit.assert_not_called()
            api.request.assert_any_call("DELETE", "/admin/users/fixture")

    def test_desktop_recovery_only_imports_outline_fixture_without_secrets_or_config(self):
        with tempfile.TemporaryDirectory() as temp:
            source, target = Path(temp)/"private.local.json", Path(temp)/"recovery.json"
            values = {"baseUrl": ALLOWED_API, "runId": "a"*32, "runMode": "outline", "adminPassword": "TOP_SECRET"}
            write_json(source, {"values": [{"key": key, "value": value} for key, value in values.items()]})
            import_postman_recovery(source, target)
            output = target.read_text(encoding="utf-8")
            self.assertNotIn("TOP_SECRET", output)
            manifest = json.loads(output)
            self.assertIsNone(manifest["originalConfig"])
            self.assertEqual(len(manifest["fixtureEmails"]), 1)


if __name__ == "__main__":
    unittest.main()
