"""Execute the local collection with Postman CLI and journaled recovery.

No Postman account is required for v2.1 JSON runs with the local JSON reporter.
Raw reports and the temporary credential file are deleted after a sanitized report
is written. Email tests are staged in the Postman desktop app (see run guide).
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import uuid
import re
from collections import Counter
from contextlib import nullcontext
from pathlib import Path
from urllib.parse import urlparse, urlencode

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from qa_support import Api, Blocked, exclusive_run, new_manifest, now, recover, settings, write_json
from evidence_support import SECRET_KEY, safe_text, safe_data, safe_url, source_snapshot, seal, write_junit
from reporting import publish

HERE = Path(__file__).resolve().parent
FOLDERS = {"public": "Public smoke", "core": "Core", "ai": "AI integration"}


def leaf_count(item):
    return sum(leaf_count(child) if "item" in child else 1 for child in item["item"])


def plan_matches(expected_items, actual_rows):
    # Postman expands {{variables}} inside display names. Item IDs are stable.
    expected = [item.get("id") for item in expected_items]
    actual = [row.get("id") for row in actual_rows]
    return bool(expected) and all(expected) and all(actual) and Counter(expected) == Counter(actual)


def cli_body(container):
    stream = (container or {}).get("stream", {})
    if isinstance(stream, dict):
        text = bytes(stream.get("data", [])).decode("utf-8", errors="replace")
    else:
        text = str(stream or "")
    if not text:
        return None
    try:
        return json.loads(text)
    except ValueError:
        return text


def cli_url(url):
    if isinstance(url, str):
        return safe_url(url)
    if not isinstance(url, dict):
        return ""
    if url.get("raw"):
        return safe_url(url["raw"])
    host = url.get("host", [])
    host = ".".join(host) if isinstance(host, list) else str(host)
    protocol = url.get("protocol", "")
    port = ":" + str(url["port"]) if url.get("port") else ""
    parts = url.get("path", [])
    path = "/" + "/".join(str(p) for p in parts) if isinstance(parts, list) else str(parts)
    query = [(str(q["key"]), str(q.get("value", ""))) for q in url.get("query", []) if not q.get("disabled")]
    if not host or not protocol:
        return ""
    return safe_url(protocol + "://" + host + port + path + ("?" + urlencode(query) if query else ""))


def find_secrets(value):
    result = []
    if isinstance(value, dict):
        for key, item in value.items():
            if SECRET_KEY.search(str(key)) and isinstance(item, str):
                result.append(item)
            else:
                result.extend(find_secrets(item))
    elif isinstance(value, list):
        for item in value:
            result.extend(find_secrets(item))
    return result


def sanitized_results(raw):
    run = raw.get("run", raw)
    executions = run.get("executions", [])
    rows, objects = [], []
    expected = {row["id"]: row["status"] for row in json.loads((HERE / "coverage.json").read_text(encoding="utf-8"))}
    for execution in executions:
        request = execution.get("requestExecuted", execution.get("request", {}))
        response = execution.get("response") or {}
        body = cli_body(response)
        request_body = request.get("body", {}).get("raw")
        try:
            request_body = json.loads(request_body) if request_body else None
        except ValueError:
            pass
        secrets = find_secrets(body) + find_secrets(request_body)
        assertions = execution.get("tests", execution.get("assertions", []))
        assertion_results = [{"name": a.get("name", a.get("assertion", "Unnamed assertion")),
                              "status": a.get("status", "failed" if a.get("error") else "passed").upper(),
                              "error": safe_text((a.get("error") or {}).get("message", ""), secrets)} for a in assertions]
        failed = [a["name"] for a in assertion_results if a["status"] != "PASSED" or a["error"]]
        request_error = execution.get("requestError") or execution.get("errors")
        endpoint = cli_url(request.get("url"))
        method = request.get("method")
        name = request.get("name", execution.get("item", {}).get("name", "Unnamed request"))
        match = re.match(r"(API-\d+)\b", name)
        metadata_errors = []
        if not method or not endpoint:
            metadata_errors.append("Executed method or URL missing from CLI evidence")
        if request_error:
            metadata_errors.append("CLI request/script error recorded")
        rows.append({"name": name, "id": request.get("id"), "iteration": execution.get("iterationCount", 0),
                     "status": "FAILED" if failed or metadata_errors or not assertions else "PASSED",
                     "method": method or "UNKNOWN", "endpoint": endpoint or "Not recorded",
                     "expectedHttpStatus": expected.get(match.group(1)) if match else None,
                     "httpStatus": response.get("code"), "responseMs": response.get("responseTime"),
                     "assertions": len(assertions), "assertionResults": assertion_results,
                     "failedAssertions": failed + metadata_errors,
                     "transportError": bool(request_error),
                     "request": {"method": method or "UNKNOWN", "url": endpoint, "body": safe_data(request_body, secrets)},
                     "response": {"httpStatus": response.get("code"), "body": safe_data(body, secrets)},
                     "redaction": "Credentials, JWTs, OTPs, real email addresses and signed query parameters are redacted."})
        if isinstance(body, dict) and isinstance(body.get("data"), dict) and body["data"].get("downloadUrl"):
            objects.append(urlparse(body["data"]["downloadUrl"]).path)
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
    summary.setdefault("schemaVersion", 2)
    summary.setdefault("kind", "postman")
    summary.setdefault("runId", directory.name)
    errors = list(summary.get("runErrors", []))
    if summary.get("status") != "PASSED" and summary.get("reason"):
        errors.append(summary["reason"])
    write_junit(directory, "ABSlider Postman evidence", summary["requests"], errors)
    publish(directory, summary)
    seal(directory)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=FOLDERS, default="core")
    args = parser.parse_args()
    directory = HERE / "reports" / uuid.uuid4().hex
    directory.mkdir(parents=True)
    summary = {"schemaVersion": 2, "kind": "postman", "runId": directory.name,
               "mode": args.mode, "started": now(), "status": "RUNNING", "requests": [],
               "expectedRequests": 0, "cleanup": "not-started", "runErrors": [],
               "target": "Not yet verified", "source": source_snapshot(directory, "postman")}
    publish(directory, summary)
    api, recovery_path = None, None
    env_path, raw_path = directory / "runtime.local.json", directory / "raw.local.json"
    try:
        config = settings()
        summary["target"] = config["api"]
        resolved = shutil.which(os.getenv("QA_POSTMAN_BINARY", "postman"))
        if not resolved:
            raise Blocked("Postman CLI not found. Set QA_POSTMAN_BINARY or install postman-cli.")
        collection = json.loads((HERE / "ABSlider.postman_collection.json").read_text(encoding="utf-8"))
        folder = next(item for item in collection["item"] if item["name"] == FOLDERS[args.mode])
        def leaves(item):
            return [n for child in item["item"] for n in (leaves(child) if "item" in child else [child])]
        planned = leaves(folder)
        summary["plannedRequests"] = [{"id": item["id"], "name": item["name"]} for item in planned]
        summary["expectedRequests"] = len(summary["plannedRequests"])
        api = Api(config)
        with exclusive_run() if args.mode != "public" else nullcontext():
            try:
                values = {"baseUrl": config["api"], "runMode": args.mode,
                          "allowMutations": "true" if args.mode != "public" else "false",
                          "managedRun": "true", "adminEmail": config["email"], "adminPassword": config["password"]}
                if args.mode != "public":
                    summary["release"] = api.preflight()
                    recovery_path, manifest = new_manifest(api, HERE / "reports", "postman-" + args.mode)
                    summary["recoveryFile"] = str(recovery_path)
                    summary["originalConfig"] = manifest["originalConfig"]
                    values["runId"] = manifest["runId"]
                    summary["cleanup"] = "pending"
                else:
                    summary["cleanup"] = "not-needed"
                publish(directory, summary)
                write_json(env_path, {"name": "Runtime local only", "values": [
                    {"key": k, "value": v, "enabled": True} for k, v in values.items()]})
                command = [resolved, "collection", "run", str(HERE / "ABSlider.postman_collection.json"),
                           "-e", str(env_path), "-i", FOLDERS[args.mode], "--no-report-events",
                           "--ignore-redirects", "--timeout-request", "180000" if args.mode == "ai" else "30000",
                           "--timeout", "900000" if args.mode == "ai" else "300000",
                           "-r", "json", "--reporter-json-export", str(raw_path)]
                completed = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", errors="replace")
                summary["cliExitCode"] = completed.returncode
                if not raw_path.exists():
                    raise Blocked("Postman CLI did not produce a local JSON report; check CLI installation/version.")
                raw = json.loads(raw_path.read_text(encoding="utf-8"))
                rows, objects, errors = sanitized_results(raw)
                summary["requests"], summary["storageObjects"] = rows, objects
                summary["runtimeSummary"] = safe_data(raw.get("run", raw).get("summary", {}))
                if args.mode == "public":
                    for execution in raw.get("run", raw).get("executions", []):
                        req = execution.get("requestExecuted", {})
                        if urlparse(cli_url(req.get("url"))).path.endswith('/version'):
                            body = cli_body(execution.get("response"))
                            if isinstance(body, dict): summary["release"] = body.get("data", {}).get("release")
                if recovery_path:
                    manifest = json.loads(recovery_path.read_text(encoding="utf-8"))
                    manifest["storageObjects"] = objects
                    manifest["createdResources"] = created_resource_ids(raw, manifest)
                    manifest["fixtureIds"] = manifest["createdResources"]["users"]
                    write_json(recovery_path, manifest)
                complete = plan_matches(summary["plannedRequests"], rows)
                if errors:
                    summary["runErrors"].append(str(errors) + " CLI runtime failures")
                summary["status"] = "PASSED" if completed.returncode == 0 and not errors and complete and all(r["status"] == "PASSED" for r in rows) else "FAILED"
                if not complete:
                    summary["reason"] = "The executed request identities do not match the planned folder; missing, duplicated or extra executions exist."
            finally:
                if recovery_path:
                    try:
                        recover(api, recovery_path)
                        summary["cleanup"] = "verified"
                        summary["restoredConfig"] = api.credit_observation
                    except (AssertionError, Blocked) as error:
                        summary["status"], summary["cleanup"] = "FAILED", "failed"
                        summary["runErrors"].append("Recovery: " + str(error))
                    finally:
                        write_json(directory / "recovery.json", json.loads(recovery_path.read_text(encoding="utf-8")))
    except (Blocked, AssertionError, OSError, ValueError) as error:
        summary["reason"] = safe_text(error)
        summary["status"] = "BLOCKED" if isinstance(error, (Blocked, OSError)) else "FAILED"
    except KeyboardInterrupt:
        summary["status"] = "INTERRUPTED"
        summary["reason"] = "Execution interrupted; see recovery journal."
    finally:
        env_path.unlink(missing_ok=True)
        raw_path.unlink(missing_ok=True)
        if api:
            try:
                api.logout()
            except (AssertionError, Blocked) as error:
                summary["runErrors"].append("Logout: " + safe_text(error))
        if summary["status"] == "RUNNING":
            summary["status"] = "INTERRUPTED"
        if summary["runErrors"]:
            summary["status"] = "FAILED"
        summary["finished"] = now()
        reports(directory, summary)
        print(f'{summary["status"]}: {len(summary["requests"])} / {summary["expectedRequests"]} requests; cleanup={summary["cleanup"]}')
        print('Latest report: ' + str(HERE / 'reports/latest_report.html'))
        if summary.get("reason"): print(summary["reason"])
    return 0 if summary["status"] == "PASSED" else 2 if summary["status"] in ("BLOCKED", "INTERRUPTED") else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Blocked as error:
        print("BLOCKED: " + str(error))
        raise SystemExit(2)
