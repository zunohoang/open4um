"""Shared development-only setup, recovery and sanitized evidence utilities."""
from __future__ import annotations

import json
import os
import re
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent
BASELINE = dict(pricePerLecture=80, pricePerSlide=10, pricePerAiEdit=5,
                pricePerOutline=5, signupBonus=100)
COST_FIELDS = tuple(k for k in BASELINE if k != "signupBonus")
ALLOWED_API = "https://dev-slides-api.sbltcup.dev/api/v1"
ALLOWED_WEB = "https://dev-slides.sbltcup.dev"


class Blocked(RuntimeError):
    """A prerequisite is unavailable; this is not a passing test."""


def now():
    return datetime.now(timezone.utc).isoformat()


def write_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2, ensure_ascii=False), encoding="utf-8")
    temporary.replace(path)


def settings():
    load_dotenv(ROOT / "selenium" / ".env", override=False)
    api = os.getenv("QA_API_URL", ALLOWED_API).rstrip("/")
    web = os.getenv("QA_WEB_URL", ALLOWED_WEB).rstrip("/")
    if api != ALLOWED_API or web != ALLOWED_WEB:
        raise Blocked("Only the named hosted development environment is allowed.")
    return {"api": api, "web": web, "email": os.getenv("QA_ADMIN_EMAIL", ""),
            "password": os.getenv("QA_ADMIN_PASSWORD", "")}


@contextmanager
def exclusive_run():
    """Serializes both packages on this checkout; remote QA window is still required."""
    path = ROOT / ".qa-lock"
    try:
        with path.open("x", encoding="utf-8") as handle:
            handle.write(json.dumps({"pid": os.getpid(), "started": now()}))
    except FileExistsError:
        raise Blocked("QA lock exists. Check the recorded process and recover the previous run first.") from None
    try:
        yield
    finally:
        path.unlink(missing_ok=True)


class Api:
    def __init__(self, config=None):
        self.config = config or settings()
        self.http = requests.Session()
        self.refresh_token = None

    def request(self, method, path, body=None, expected=200):
        if not path.startswith("/") or path.startswith("//"):
            raise ValueError("Relative API path required")
        try:
            response = self.http.request(method, self.config["api"] + path,
                                         json=body, timeout=(10, 40), allow_redirects=False)
        except requests.RequestException as error:
            raise Blocked(f"API transport unavailable: {type(error).__name__}") from None
        self.last_http = {"method": method, "url": self.config["api"] + path,
                          "httpStatus": response.status_code,
                          "responseMs": round(response.elapsed.total_seconds() * 1000, 2), "received": now()}
        if response.status_code != expected:
            # Never expose request headers, credentials or response bodies in exceptions.
            raise AssertionError(f"{method} {path.split('?')[0]}: expected {expected}, got {response.status_code}")
        payload = response.json()
        assert payload.get("success") is True, f"{method} {path}: success envelope missing"
        return payload["data"]

    def login(self):
        if not self.config["email"] or not self.config["password"]:
            raise Blocked("Set QA_ADMIN_EMAIL and QA_ADMIN_PASSWORD in tests/selenium/.env")
        try:
            data = self.request("POST", "/auth/login", {
                "email": self.config["email"], "password": self.config["password"]})
        except AssertionError:
            raise Blocked("QA Admin login failed; check local credentials.") from None
        if data["user"]["role"] != "admin":
            raise Blocked("The configured QA account must be an Admin.")
        self.http.headers["Authorization"] = "Bearer " + data["accessToken"]
        self.refresh_token = data["refreshToken"]
        return data

    def preflight(self, mutations=True):
        release = self.request("GET", "/version")["release"]
        if release.get("environment") != "develop":
            raise Blocked("API is not identifying itself as develop.")
        ready = self.request("GET", "/health/ready")
        if ready["status"] != "ready":
            raise Blocked("Development dependencies are not ready.")
        if mutations and os.getenv("QA_ALLOW_MUTATIONS", "false").lower() != "true":
            raise Blocked("Set QA_ALLOW_MUTATIONS=true for an exclusive development QA window.")
        self.login()
        return release

    def credit(self):
        data = self.request("GET", "/admin/credit-config")
        assert set(BASELINE).issubset(data), "Required five-field Credit contract is missing"
        result = {key: data[key] for key in BASELINE}
        assert all(type(v) is int and v > 0 for v in result.values()), "Invalid stored Credit configuration"
        self.credit_observation = {**self.last_http, "body": result}
        return result

    def set_credit(self, values):
        assert set(values) == set(BASELINE), "Restore all five fields explicitly"
        assert all(type(v) is int and 0 < v <= 9007199254740991 for v in values.values()), "Invalid recovery configuration"
        self.request("PATCH", "/admin/credit-config", values)
        assert self.credit() == values, "Credit configuration did not persist"

    def logout(self):
        try:
            if self.refresh_token:
                self.request("POST", "/auth/logout", {"refreshToken": self.refresh_token})
        finally:
            self.http.close()


def new_manifest(api, directory, package, *, restore_config=True, fixture_letters="abc"):
    run_id = uuid.uuid4().hex
    manifest = {
        "schema": 1, "runId": run_id, "package": package, "started": now(),
        "api": api.config["api"], "originalConfig": api.credit() if restore_config else None,
        "fixtureEmails": [f"qa-{run_id}-{letter}@example.com" for letter in fixture_letters],
        "fixtureIds": [], "storageObjects": [], "cleanup": "pending",
    }
    path = Path(directory) / run_id / "recovery.json"
    write_json(path, manifest)
    return path, manifest


def recover(api, path):
    """Restore exact config and delete only exact, run-owned fixture users.

    Expected emails are journaled before creation so interrupted creation can be
    reconciled without exporting tokens. Admin deletion cascades owned DB records.
    Exported storage objects have no delete API and remain listed for owner cleanup.
    """
    path = Path(path)
    manifest = json.loads(path.read_text(encoding="utf-8"))
    if manifest.get("api") != api.config["api"] or manifest.get("schema") != 1:
        raise ValueError("Recovery manifest environment/schema mismatch")
    if not re.fullmatch(r"[0-9a-f]{32}", manifest.get("runId", "")):
        raise ValueError("Invalid run namespace")
    if manifest.get("cleanup") == "complete":
        return manifest
    failures = []
    try:
        if manifest.get("originalConfig") is not None:
            api.set_credit(manifest["originalConfig"])
        manifest["configRestored"] = True
    except (AssertionError, Blocked) as error:
        failures.append(str(error))
    prefix = "qa-" + manifest["runId"] + "-"
    for email in manifest.get("fixtureEmails", []):
        if not email.startswith(prefix) or not email.endswith("@example.com"):
            # Email integration users are registered with a real controlled mailbox,
            # identified by exact recorded ID instead (see separate manual flow).
            failures.append("Refused fixture email outside this run namespace")
            continue
        try:
            data = api.request("GET", "/admin/users?limit=100&search=" + requests.utils.quote(email))
            users = [u for u in data["items"] if u["email"] == email]
            for user in users:
                assert user["role"] == "user", "Refusing to delete an Admin"
                assert user["name"].startswith("QA-" + manifest["runId"]), "Fixture name does not match run"
                if user["_id"] not in manifest["fixtureIds"]:
                    manifest["fixtureIds"].append(user["_id"])
                    write_json(path, manifest)
                api.request("DELETE", "/admin/users/" + user["_id"])
            verify = api.request("GET", "/admin/users?search=" + requests.utils.quote(email))
            assert not any(u["email"] == email for u in verify["items"]), "Fixture user remains"
        except (AssertionError, Blocked) as error:
            failures.append(str(error))
    if manifest.get("mailFixture"):
        fixture = manifest["mailFixture"]
        try:
            data = api.request("GET", "/admin/users?limit=100&search=" + requests.utils.quote(fixture["email"]))
            users = [u for u in data["items"] if u["email"] == fixture["email"]]
            for user in users:
                assert user["_id"] == fixture["id"] and user["role"] == "user", "Mailbox fixture identity mismatch"
                assert user["name"] == "QA-" + manifest["runId"] + "-Mail", "Mailbox fixture name mismatch"
                api.request("DELETE", "/admin/users/" + user["_id"])
            verify = api.request("GET", "/admin/users?search=" + requests.utils.quote(fixture["email"]))
            assert not any(u["email"] == fixture["email"] for u in verify["items"]), "Mailbox fixture remains"
        except (AssertionError, Blocked) as error:
            failures.append(str(error))
    manifest["cleanup"] = "failed" if failures else "complete"
    manifest["cleanupErrors"] = failures
    manifest["finished"] = now()
    write_json(path, manifest)
    if failures:
        raise AssertionError("Recovery incomplete: " + "; ".join(failures))
    return manifest


def import_postman_recovery(environment_path, output_path):
    """Convert a PRIVATE environment export into a secret-free recovery journal."""
    raw = json.loads(Path(environment_path).read_text(encoding="utf-8-sig"))
    values = {entry["key"]: entry.get("value", "") for entry in raw["values"]}
    run_id = values.get("runId", "")
    if not re.fullmatch(r"[0-9a-f]{32}", run_id):
        raise ValueError("Environment has no valid runId")
    is_email = values.get("runMode") == "email"
    is_outline = values.get("runMode") == "outline"
    manifest = {"schema": 1, "api": values["baseUrl"], "runId": run_id,
                "originalConfig": None if is_email or is_outline else json.loads(values["originalConfig"]),
                "fixtureEmails": [] if is_email else [f"qa-{run_id}-{letter}@example.com" for letter in ("a" if is_outline else "abc")],
                "fixtureIds": [], "storageObjects": [], "cleanup": "pending"}
    if values.get("mailUserId"):
        manifest["mailFixture"] = {"id": values["mailUserId"], "email": values["mailbox"]}
    write_json(output_path, manifest)
    return Path(output_path)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Recover a recorded hosted development QA run")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--recover", type=Path)
    group.add_argument("--postman-environment", type=Path, help="PRIVATE environment export from an interrupted GUI run")
    args = parser.parse_args()
    client = Api()
    try:
        with exclusive_run():
            client.preflight()
            recovery_path = args.recover
            if args.postman_environment:
                recovery_path = import_postman_recovery(args.postman_environment,
                    ROOT / "postman" / "reports" / (uuid.uuid4().hex + "-recovery.json"))
            recover(client, recovery_path)
        print("Configuration restoration and fixture cleanup verified.")
    finally:
        client.logout()
