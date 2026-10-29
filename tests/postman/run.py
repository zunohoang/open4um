"""Execute the local collection with Postman CLI and journaled recovery.

No Postman account is required for v2.1 JSON runs with the local JSON reporter.
Raw reports and the temporary credential file are deleted after a sanitized report
is written. Email tests are staged in the Postman desktop app (see run guide).
"""
from __future__ import annotations

import argparse
import html
import json
import os
import shutil
import subprocess
import sys
import uuid
from contextlib import nullcontext
from pathlib import Path
from urllib.parse import urlparse
from xml.etree import ElementTree as ET

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from qa_support import Api, Blocked, exclusive_run, new_manifest, now, recover, settings, write_json

HERE = Path(__file__).resolve().parent
FOLDERS = {"public": "Public smoke", "core": "Core", "ai": "AI integration"}


def leaf_count(item):
    return sum(leaf_count(child) if "item" in child else 1 for child in item["item"])


def sanitized_results(raw):
    run = raw.get("run", raw)
    executions = run.get("executions", [])
    rows, objects = [], []
    for execution in executions:
        assertions = execution.get("tests", execution.get("assertions", []))
        failed = [a.get("name", a.get("assertion", "Unnamed assertion")) for a in assertions
                  if a.get("error") or a.get("status", "passed") != "passed"]
        response = execution.get("response") or {}
        request_error = execution.get("requestError") or execution.get("errors")
        rows.append({"name": execution.get("requestExecuted", execution.get("item", {})).get("name", "Unnamed request"),
                     "status": "FAILED" if failed or request_error or not assertions else "PASSED",
                     "httpStatus": response.get("code"), "responseMs": response.get("responseTime"),
                     "assertions": len(assertions), "failedAssertions": failed,
                     "transportError": bool(request_error)})
        # Keep only object paths. Presigned URL query strings are credentials.
        stream = response.get("stream", {})
        try:
            data = bytes(stream.get("data", [])).decode("utf-8") if isinstance(stream, dict) else str(stream)
            url = json.loads(data).get("data", {}).get("downloadUrl")
            if url:
                objects.append(urlparse(url).path)
        except (ValueError, AttributeError, TypeError):
            pass
    errors = len(run.get("failures", [])) + int(bool(run.get("runError")))
    errors += sum(bool(e.get("errors")) for e in executions)
    return rows, sorted(set(objects)), errors


def created_resource_ids(raw, manifest):
    """Retain run-owned creation IDs without retaining response bodies or tokens."""
    payloads = []
    for execution in raw.get("run", raw).get("executions", []):
        response = execution.get("response") or {}
        stream = response.get("stream", {})
        try:
            content = bytes(stream.get("data", [])).decode("utf-8") if isinstance(stream, dict) else str(stream)
            data = json.loads(content).get("data")
            if isinstance(data, dict):
                payloads.append((response.get("code"), data))
        except (ValueError, TypeError):
            continue
    users = {data["_id"] for code, data in payloads
             if code == 201 and data.get("email") in manifest["fixtureEmails"]
             and data.get("role") == "user" and data.get("name", "").startswith("QA-" + manifest["runId"])
             and data.get("_id")}
    lectures, folders = set(), set()
    for code, data in payloads:
        # AI outline responses nest the newly created lecture under `lecture`.
        candidates = [data] if code == 201 else [data.get("lecture")]
        for resource in candidates:
            if not isinstance(resource, dict) or resource.get("userId") not in users or not resource.get("_id"):
                continue
            if isinstance(resource.get("slides"), list):
                lectures.add(resource["_id"])
            elif "name" in resource:
                folders.add(resource["_id"])
    return {"users": sorted(users), "lectures": sorted(lectures), "folders": sorted(folders)}


def reports(directory, summary):
    write_json(directory / "summary.json", summary)
    suite = ET.Element("testsuite", name="ABSlider Postman " + summary["mode"],
                       tests=str(len(summary["requests"])),
                       failures=str(sum(r["status"] == "FAILED" for r in summary["requests"])))
    table = []
    for row in summary["requests"]:
        case = ET.SubElement(suite, "testcase", name=row["name"], time=str((row.get("responseMs") or 0) / 1000))
        if row["status"] == "FAILED":
            ET.SubElement(case, "failure", message="; ".join(row["failedAssertions"]) or "No assertions/transport failure")
        table.append(f'<tr><td>{html.escape(row["name"])}</td><td>{row["status"]}</td>'
                     f'<td>{row["httpStatus"]}</td><td>{html.escape("; ".join(row["failedAssertions"]))}</td></tr>')
    if summary["status"] != "PASSED" and not any(r["status"] == "FAILED" for r in summary["requests"]):
        case = ET.SubElement(suite, "testcase", name="Run completion and cleanup")
        ET.SubElement(case, "error", message=summary.get("reason", "Incomplete run or cleanup"))
        suite.set("tests", str(len(summary["requests"]) + 1))
        suite.set("errors", "1")
    ET.ElementTree(suite).write(directory / "junit.xml", encoding="utf-8", xml_declaration=True)
    (directory / "report.html").write_text('<!doctype html><meta charset="utf-8"><title>API QA report</title>'
        '<style>body{font:15px sans-serif;margin:2rem}td,th{border:1px solid #bbb;padding:8px}table{border-collapse:collapse}</style>'
        f'<h1>ABSlider API: {html.escape(summary["status"])}</h1><p>{html.escape(summary.get("reason", ""))}</p>'
        '<table><tr><th>Request</th><th>Status</th><th>HTTP</th><th>Failed assertions</th></tr>'
        + ''.join(table) + '</table>', encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=FOLDERS, default="core")
    args = parser.parse_args()
    config = settings()
    binary = os.getenv("QA_POSTMAN_BINARY", "postman")
    resolved = shutil.which(binary)
    if not resolved:
        raise Blocked("Postman CLI not found. Set QA_POSTMAN_BINARY or install postman-cli.")
    collection = json.loads((HERE / "ABSlider.postman_collection.json").read_text(encoding="utf-8"))
    folder = next(item for item in collection["item"] if item["name"] == FOLDERS[args.mode])
    directory = HERE / "reports" / uuid.uuid4().hex
    directory.mkdir(parents=True)
    summary = {"mode": args.mode, "started": now(), "status": "BLOCKED", "requests": [],
               "expectedRequests": leaf_count(folder), "cleanup": "not-needed"}
    api = Api(config)
    recovery_path = None
    env_path = directory / "runtime.local.json"
    raw_path = directory / "raw.local.json"
    try:
        with exclusive_run() if args.mode != "public" else nullcontext():
            try:
                values = {"baseUrl": config["api"], "runMode": args.mode,
                          "allowMutations": "true" if args.mode != "public" else "false",
                          "managedRun": "true", "adminEmail": config["email"], "adminPassword": config["password"]}
                if args.mode != "public":
                    summary["release"] = api.preflight()
                    recovery_path, manifest = new_manifest(api, HERE / "reports", "postman-" + args.mode)
                    summary["recoveryFile"] = str(recovery_path)
                    values["runId"] = manifest["runId"]
                    summary["cleanup"] = "pending"
                write_json(env_path, {"name": "Runtime local only", "values": [
                    {"key": k, "value": v, "enabled": True} for k, v in values.items()]})
                command = [resolved, "collection", "run", str(HERE / "ABSlider.postman_collection.json"),
                           "-e", str(env_path), "-i", FOLDERS[args.mode], "--no-report-events",
                           "--ignore-redirects", "--timeout-request", "180000" if args.mode == "ai" else "30000",
                           "-r", "json", "--reporter-json-export", str(raw_path)]
                completed = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", errors="replace")
                if not raw_path.exists():
                    raise Blocked("Postman CLI did not produce a local JSON report; check CLI installation/version.")
                raw = json.loads(raw_path.read_text(encoding="utf-8"))
                rows, objects, errors = sanitized_results(raw)
                summary["requests"] = rows
                summary["storageObjects"] = objects
                if recovery_path:
                    manifest = json.loads(recovery_path.read_text(encoding="utf-8"))
                    manifest["storageObjects"] = objects
                    manifest["createdResources"] = created_resource_ids(raw, manifest)
                    manifest["fixtureIds"] = manifest["createdResources"]["users"]
                    write_json(recovery_path, manifest)
                all_ran = len(rows) == summary["expectedRequests"]
                summary["status"] = "PASSED" if completed.returncode == 0 and not errors and all_ran and all(r["status"] == "PASSED" for r in rows) else "FAILED"
                if not all_ran:
                    summary["reason"] = f'Incomplete: executed {len(rows)} of {summary["expectedRequests"]} requests'
            except (Blocked, AssertionError, OSError, ValueError) as error:
                summary["reason"] = str(error)
                summary["status"] = "BLOCKED" if isinstance(error, (Blocked, OSError)) else "FAILED"
            finally:
                if recovery_path:
                    try:
                        recover(api, recovery_path)
                        summary["cleanup"] = "verified"
                    except (AssertionError, Blocked) as error:
                        summary["status"] = "FAILED"
                        summary["cleanup"] = "failed"
                        summary["reason"] = str(error)
    finally:
        # Credential material is never retained in the readable/JUnit/summary reports.
        env_path.unlink(missing_ok=True)
        raw_path.unlink(missing_ok=True)
        try:
            api.logout()
        except (AssertionError, Blocked):
            summary["logout"] = "unverified"
        summary["finished"] = now()
        reports(directory, summary)
        print(f'{summary["status"]}: {len(summary["requests"])} / {summary["expectedRequests"]} requests; cleanup={summary["cleanup"]}')
        print(f'Report: {directory / "report.html"}')
        if summary.get("reason"):
            print(summary["reason"])
    return 0 if summary["status"] == "PASSED" else 2 if summary["status"] == "BLOCKED" else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Blocked as error:
        print("BLOCKED: " + str(error))
        raise SystemExit(2)
