"""Run-local evidence, privacy controls, and integrity verification.

Hashes detect subsequent edits; they are not a trusted timestamp or a digital
signature. Screenshots remain unmodified browser pixels.
"""
from __future__ import annotations

import hashlib
import json
import re
import shutil
import subprocess
from pathlib import Path
from urllib.parse import parse_qsl, quote, urlencode, urlsplit, urlunsplit
from xml.etree import ElementTree as ET

from qa_support import ROOT, now, write_json

SECRET_KEY = re.compile(r"password|passwd|secret|token|authorization|cookie|otp|signature|api.?key|credential", re.I)
REDACTED = "[REDACTED_SECRET]"


def digest(data):
    return hashlib.sha256(data).hexdigest()


def safe_text(value, secrets=()):
    text = str(value)
    for secret in sorted((s for s in secrets if s), key=len, reverse=True):
        text = text.replace(str(secret), REDACTED)
    text = re.sub(r"\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b", REDACTED, text)
    text = re.sub(r"(?i)(bearer\s+)[A-Za-z0-9._~-]+", r"\1" + REDACTED, text)
    text = re.sub(r"https?://[^\s\"'<>]+", lambda m: safe_url(m.group(0)), text)
    return text


def safe_url(value):
    """Preserve non-secret request semantics, including ordinary query filters."""
    p = urlsplit(str(value))
    host = p.hostname or ""
    if ":" in host:
        host = "[" + host + "]"
    if p.port:
        host += ":" + str(p.port)
    if p.username is not None:
        host = "[REDACTED_USERINFO]@" + host
    query = [(key, REDACTED if SECRET_KEY.search(key) or key.lower() in {"key", "code"} else val)
             for key, val in parse_qsl(p.query, keep_blank_values=True)]
    return urlunsplit((p.scheme, host, p.path, urlencode(query), ""))


def safe_data(value, secrets=()):
    if isinstance(value, dict):
        result = {}
        for key, val in value.items():
            if SECRET_KEY.search(str(key)):
                result[key] = REDACTED
            elif str(key).lower() == "email" and isinstance(val, str) and not re.fullmatch(r"qa-[0-9a-f]{32}-[abc]@example\.com", val):
                result[key] = "[REDACTED_EMAIL]"
            else:
                result[key] = safe_data(val, secrets)
        return result
    if isinstance(value, list):
        return [safe_data(v, secrets) for v in value]
    if isinstance(value, str):
        return safe_url(value) if value.startswith(("https://", "http://")) else safe_text(value, secrets)
    return value


def source_snapshot(directory, kind):
    repo = ROOT.parent
    common = [ROOT / name for name in ("qa_support.py", "evidence_support.py", "reporting.py")]
    if kind == "selenium":
        files = common + [ROOT / "selenium" / name for name in
            ("conftest.py", "evidence.py", "evidence_canary.py", "test_uc032_01.py", "test_uc032_02.py", "requirements.txt", "pytest.ini")]
        files += sorted((ROOT / "selenium/pages").glob("*.py"))
    else:
        names = ("run.py", "outline/generate.mjs", "outline/AI-Outline.postman_collection.json", "outline/coverage.json") if kind == "postman-outline" else ("run.py", "ABSlider.postman_collection.json", "coverage.json")
        files = common + [ROOT / "postman" / name for name in names]
    entries = []
    for source in files:
        if not source.exists():
            continue
        relative = source.relative_to(repo).as_posix()
        target = directory / "source" / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
        entries.append({"path": relative, "sha256": digest(source.read_bytes())})
    try:
        revision = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=repo, text=True, stderr=subprocess.DEVNULL).strip()
        dirty = bool(subprocess.check_output(["git", "status", "--porcelain", "--", "tests"], cwd=repo, text=True))
    except (OSError, subprocess.CalledProcessError):
        revision, dirty = "unavailable", None
    return {"revision": revision, "dirty": dirty, "files": entries}


def seal(directory):
    """Hash every run-owned artifact, excluding only the manifest itself."""
    directory = Path(directory)
    entries = []
    for path in sorted(directory.rglob("*")):
        if not path.is_file() or path.name == "integrity.json" or path.name.endswith((".tmp", ".local.json")):
            continue
        entries.append({"path": path.relative_to(directory).as_posix(),
                        "bytes": path.stat().st_size, "sha256": digest(path.read_bytes())})
    write_json(directory / "integrity.json", {"schemaVersion": 1, "sealed": now(), "files": entries,
        "meaning": "Content checksums detect changes after sealing; this is not a digital signature or trusted timestamp."})


def verify(directory):
    directory = Path(directory).resolve()
    try:
        manifest = json.loads((directory / "integrity.json").read_text(encoding="utf-8"))
        summary = json.loads((directory / "summary.json").read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        return ["Run is unsealed or unreadable: " + type(error).__name__]
    errors = []
    indexed = {entry["path"] for entry in manifest.get("files", [])}
    for required in ("summary.json", "report.html", "junit.xml"):
        if required not in indexed:
            errors.append("Required artifact not sealed: " + required)
    for entry in manifest["files"]:
        path = (directory / entry["path"]).resolve()
        if not path.is_relative_to(directory) or not path.is_file():
            errors.append("Missing/unsafe artifact: " + entry["path"])
        elif digest(path.read_bytes()) != entry["sha256"] or path.stat().st_size != entry["bytes"]:
            errors.append("Changed artifact: " + entry["path"])
    if summary.get("status") == "PASSED":
        rows = summary.get("tests", summary.get("requests", []))
        if not rows or any(row.get("status") != "PASSED" for row in rows) or summary.get("runErrors"):
            errors.append("Passing run conflicts with recorded execution outcomes")
        if summary.get("cleanup") not in ("verified", "not-needed"):
            errors.append("Passing run has no verified cleanup state")
        if summary.get("kind") == "selenium" and (len(rows) != 30 or set(summary.get("cases", {}).values()) != {"PASSED"}):
            errors.append("Passing Selenium suite does not establish both complete cases")
    for row in summary.get("tests", []):
        for checkpoint in row.get("checkpoints", []):
            for artifact in checkpoint.get("artifacts", []):
                path = (directory / artifact["path"]).resolve()
                if (not path.is_relative_to(directory) or artifact["path"] not in indexed
                        or not path.is_file() or digest(path.read_bytes()) != artifact["sha256"]):
                    errors.append("Screenshot does not match checkpoint: " + artifact["path"])
    return errors


def write_junit(directory, title, rows, run_errors=()):
    suite = ET.Element("testsuite", name=title, tests=str(len(rows) + len(run_errors)))
    counts = {"failures": 0, "errors": 0, "skipped": 0}
    for row in rows:
        case = ET.SubElement(suite, "testcase", name=row.get("test", row.get("name", "Unknown")),
                             time=str((row.get("durationMs", row.get("responseMs")) or 0) / 1000))
        status = row.get("status", "NOT_RUN")
        if status == "FAILED":
            counts["failures"] += 1
            ET.SubElement(case, "failure", message=safe_text(row.get("error") or "; ".join(row.get("failedAssertions", [])) or "Check failed"))
        elif status != "PASSED":
            counts["skipped"] += 1
            ET.SubElement(case, "skipped", message=status + ": " + safe_text(row.get("error", "Not fully executed")))
    for error in run_errors:
        counts["errors"] += 1
        case = ET.SubElement(suite, "testcase", name="Run completion, evidence and recovery")
        ET.SubElement(case, "error", message=safe_text(error))
    for key, value in counts.items():
        suite.set(key, str(value))
    ET.ElementTree(suite).write(Path(directory) / "junit.xml", encoding="utf-8", xml_declaration=True)
