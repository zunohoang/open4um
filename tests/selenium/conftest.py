from __future__ import annotations

import importlib.metadata
import os
import sys
import uuid
from pathlib import Path

import pytest
import requests
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.common.exceptions import WebDriverException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from qa_support import Api, BASELINE, Blocked, exclusive_run, recover, settings, write_json, now
from evidence_support import safe_text, source_snapshot, seal, write_junit
from reporting import publish
from evidence import StepEvidence, missing_evidence
from pages.login_page import LoginPage
from pages.credit_config_page import CreditConfigPage

RUN = None
DIRECTORY = None
SECRETS = ()


def pytest_addoption(parser):
    parser.addoption("--headless", action="store_true", help="Run Chrome without a visible window")
    parser.addoption("--evidence-diagnostic", action="store_true", help="Keep deliberate harness diagnostics outside the main latest report")


def emit():
    if RUN is not None:
        publish(DIRECTORY, RUN)


def pytest_collection_finish(session):
    global RUN, DIRECTORY, SECRETS
    if session.config.getoption("collectonly"):
        return
    config = settings()
    SECRETS = (config["password"], config["email"])
    run_id = uuid.uuid4().hex
    base = Path(__file__).parent / "reports"
    diagnostic = session.config.getoption("--evidence-diagnostic")
    DIRECTORY = (base / "diagnostics" if diagnostic else base) / run_id
    DIRECTORY.mkdir(parents=True)
    RUN = {"schemaVersion": 2, "kind": "selenium", "runId": run_id,
           "started": now(), "status": "RUNNING", "cleanup": "not-started", "diagnostic": diagnostic,
           "target": {"web": config["web"], "api": config["api"]}, "runErrors": [],
           "source": source_snapshot(DIRECTORY, "selenium"),
           "plannedTests": [item.nodeid for item in session.items],
           "tests": [{"test": item.nodeid, "status": "NOT_RUN", "checkpoints": [], "phases": {}}
                     for item in session.items],
           "tooling": {name: importlib.metadata.version(name) for name in ("pytest", "selenium")}}
    emit()


def pytest_collection_modifyitems(config, items):
    for item in items:
        if item.path.name == "evidence_canary.py" and not config.getoption("--evidence-diagnostic"):
            item.add_marker(pytest.mark.skip(reason="Intentional failure canary requires --evidence-diagnostic"))


def row_for(nodeid):
    return next(r for r in RUN["tests"] if r["test"] == nodeid)


def pytest_runtest_logstart(nodeid, location):
    if RUN is not None:
        row_for(nodeid)["started"] = now()


def pytest_collectreport(report):
    if report.failed and RUN is not None:
        RUN["runErrors"].append("Collection failed: " + safe_text(report.longrepr, SECRETS))


@pytest.fixture(scope="session")
def qa_run():
    api = Api()
    try:
        with exclusive_run():
            try:
                RUN["release"] = api.preflight()
                frontend = requests.get(api.config["web"] + "/version.json", timeout=15)
                frontend.raise_for_status()
                RUN["frontendRelease"] = frontend.json()
            except requests.RequestException:
                pytest.skip("BLOCKED: frontend release metadata could not be recorded")
            except Blocked as error:
                pytest.skip("BLOCKED: " + str(error))
            original = api.credit()
            journal = {"schema": 1, "runId": RUN["runId"], "package": "selenium", "started": RUN["started"],
                       "api": api.config["api"], "originalConfig": original, "fixtureEmails": [],
                       "fixtureIds": [], "storageObjects": [], "cleanup": "pending", "release": RUN["release"]}
            recovery_path = DIRECTORY / "recovery.json"
            write_json(recovery_path, journal)
            RUN["cleanup"] = "pending"
            RUN["originalConfig"] = original
            emit()
            state = {"api": api, "directory": DIRECTORY, "healthy": True}
            try:
                yield state
            finally:
                try:
                    recover(api, recovery_path)
                    RUN["cleanup"] = "verified"
                    RUN["restoredConfig"] = api.credit_observation
                except Exception as error:
                    RUN["cleanup"] = "failed"
                    RUN["runErrors"].append("Recovery: " + safe_text(error, SECRETS))
                    raise
                finally:
                    emit()
    except Blocked as error:
        pytest.skip("BLOCKED: " + str(error))
    finally:
        try:
            api.logout()
        except Exception as error:
            RUN["runErrors"].append("Session logout: " + safe_text(error, SECRETS))


@pytest.fixture
def credit_page(qa_run, request):
    if not qa_run["healthy"]:
        pytest.skip("BLOCKED: previous cleanup failed; recover the recorded run first")
    api, driver = qa_run["api"], None
    row = row_for(request.node.nodeid)
    try:
        api.set_credit(BASELINE)
        options = webdriver.ChromeOptions()
        if request.config.getoption("--headless"):
            options.add_argument("--headless=new")
        options.add_argument("--window-size=1440,1400")
        options.add_argument("--disable-notifications")
        options.add_experimental_option("prefs", {"credentials_enable_service": False, "profile.password_manager_enabled": False})
        options.set_capability("goog:loggingPrefs", {"performance": "ALL"})
        if os.getenv("QA_CHROME_BINARY"):
            options.binary_location = os.environ["QA_CHROME_BINARY"]
        service = Service(os.environ["QA_CHROMEDRIVER"]) if os.getenv("QA_CHROMEDRIVER") else Service()
        try:
            driver = webdriver.Chrome(service=service, options=options)
        except WebDriverException:
            pytest.skip("BLOCKED: Chrome/ChromeDriver could not start")
        request.node.qa_driver = driver
        row["browser"] = {"name": driver.capabilities.get("browserName"),
                          "version": driver.capabilities.get("browserVersion"),
                          "platform": driver.capabilities.get("platformName"),
                          "headless": request.config.getoption("--headless")}
        config = settings()
        LoginPage(driver, config["web"]).login(config["email"], config["password"])
        driver.execute_cdp_cmd("Network.enable", {})
        evidence = StepEvidence(driver, DIRECTORY, row, SECRETS, emit)
        request.node.qa_evidence = evidence
        page = CreditConfigPage(driver, evidence=evidence, api=api).open()
        page.assert_values(BASELINE, label="Initial baseline verified", stage="baseline")
        yield page
    finally:
        try:
            api.set_credit(BASELINE)
        except Exception:
            qa_run["healthy"] = False
            raise
        finally:
            if driver:
                driver.quit()


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    report = outcome.get_result()
    if RUN is None:
        return
    row = row_for(item.nodeid)
    row["phases"][report.when] = {"status": report.outcome.upper(), "durationMs": round(report.duration * 1000, 2)}
    row["durationMs"] = round(sum(p["durationMs"] for p in row["phases"].values()), 2)
    if report.failed:
        row["status"] = "FAILED"
        row["error"] = safe_text(call.excinfo.value if call.excinfo else "Test failed", SECRETS)
        evidence = getattr(item, "qa_evidence", None)
        driver = getattr(item, "qa_driver", None)
        if driver and report.when != "teardown":
            try:
                if evidence is None:
                    evidence = StepEvidence(driver, DIRECTORY, row, SECRETS, emit)
                try:
                    values = CreditConfigPage(driver).values()
                except WebDriverException:
                    values = {"page": "Credit form not available"}
                evidence.capture("failure", "State at assertion failure", values=values, expected={"outcome": "assertions pass"})
            except Exception as error:
                row["captureError"] = safe_text(type(error).__name__, SECRETS)
    elif report.skipped and row["status"] != "FAILED":
        row["status"] = "BLOCKED"
        row["error"] = safe_text(report.longrepr, SECRETS)
    elif report.when == "call" and row["status"] not in ("FAILED", "BLOCKED"):
        row["status"] = "PASSED"
    row["finished"] = now()
    emit()


def pytest_sessionfinish(session, exitstatus):
    if RUN is None:
        return
    cases = {}
    for row in RUN["tests"]:
        missing = missing_evidence(row) if row["status"] == "PASSED" else []
        row["evidenceStatus"] = "INCOMPLETE" if missing else "COMPLETE" if row.get("checkpoints") else "NOT_CAPTURED"
        if missing:
            row["status"] = "FAILED"
            row["error"] = "Evidence incomplete: " + "; ".join(missing)
    for case, filename, expected in [("TC-73 / TC-UC032-01", "test_uc032_01.py", 1),
                                     ("TC-74 / TC-UC032-02", "test_uc032_02.py", 29)]:
        rows = [r for r in RUN["tests"] if filename in r["test"]]
        statuses = {r["status"] for r in rows}
        cases[case] = ("FAILED" if "FAILED" in statuses else "BLOCKED" if "BLOCKED" in statuses else
                       "PASSED" if len(rows) == expected and statuses == {"PASSED"} else "PARTIAL")
    RUN["cases"] = cases
    statuses = {r["status"] for r in RUN["tests"]}
    if RUN["runErrors"] or "FAILED" in statuses or RUN["cleanup"] == "failed":
        RUN["status"] = "FAILED"
    elif "BLOCKED" in statuses:
        RUN["status"] = "BLOCKED"
    elif "NOT_RUN" in statuses or session.exitstatus not in (0, 1):
        RUN["status"] = "INTERRUPTED"
    elif not RUN["tests"] or any(v != "PASSED" for v in cases.values()):
        RUN["status"] = "PARTIAL"
    else:
        RUN["status"] = "PASSED"
    RUN["finished"] = now()
    write_junit(DIRECTORY, "ABSlider Selenium evidence", RUN["tests"], RUN["runErrors"])
    emit()
    seal(DIRECTORY)
    if RUN["status"] == "FAILED" and session.exitstatus == 0:
        session.exitstatus = 1
    elif RUN["status"] in ("BLOCKED", "INTERRUPTED") and session.exitstatus == 0:
        session.exitstatus = 2
    print("\nEvidence report: " + str(DIRECTORY.parent / "latest_report.html"))
