from __future__ import annotations

import hashlib
import html
import os
import sys
from pathlib import Path

import pytest
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.common.exceptions import WebDriverException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from qa_support import Api, BASELINE, Blocked, exclusive_run, new_manifest, recover, settings, write_json, now
from pages.login_page import LoginPage
from pages.credit_config_page import CreditConfigPage

RESULTS = {}
RUN_DIRECTORY = None


def pytest_addoption(parser):
    parser.addoption("--headless", action="store_true", help="Run Chrome without a visible window")


@pytest.fixture(scope="session")
def qa_run():
    global RUN_DIRECTORY
    api = Api()
    try:
        with exclusive_run():
            try:
                release = api.preflight()
            except Blocked as error:
                pytest.skip("BLOCKED: " + str(error))
            recovery_path, manifest = new_manifest(api, Path(__file__).parent / "reports", "selenium")
            # This suite creates no user fixtures.
            manifest["fixtureEmails"] = []
            manifest["release"] = release
            write_json(recovery_path, manifest)
            RUN_DIRECTORY = recovery_path.parent
            state = {"api": api, "directory": RUN_DIRECTORY, "healthy": True}
            try:
                yield state
            finally:
                recover(api, recovery_path)
    except Blocked as error:
        pytest.skip("BLOCKED: " + str(error))
    finally:
        api.logout()


@pytest.fixture
def credit_page(qa_run, request):
    if not qa_run["healthy"]:
        pytest.skip("BLOCKED: previous cleanup failed; recover the recorded run first")
    api = qa_run["api"]
    driver = None
    try:
        api.set_credit(BASELINE)
        options = webdriver.ChromeOptions()
        if request.config.getoption("--headless"):
            options.add_argument("--headless=new")
        options.add_argument("--window-size=1440,1000")
        options.add_argument("--disable-notifications")
        if os.getenv("QA_CHROME_BINARY"):
            options.binary_location = os.environ["QA_CHROME_BINARY"]
        service = Service(os.environ["QA_CHROMEDRIVER"]) if os.getenv("QA_CHROMEDRIVER") else Service()
        try:
            driver = webdriver.Chrome(service=service, options=options)
        except WebDriverException:
            pytest.skip("BLOCKED: Chrome/ChromeDriver could not start; check Selenium Manager or QA_CHROMEDRIVER")
        request.node.qa_driver = driver
        config = settings()
        LoginPage(driver, config["web"]).login(config["email"], config["password"])
        page = CreditConfigPage(driver).open()
        page.assert_values(BASELINE)
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
    result = RESULTS.setdefault(item.nodeid, {"test": item.nodeid, "status": "NOT_RUN", "started": now()})
    if report.failed:
        result["status"] = "FAILED"
        # Avoid dumping API payloads, local variables, or authentication details.
        result["error"] = str(call.excinfo.value) if call.excinfo else "Test failed"
        driver = getattr(item, "qa_driver", None)
        if driver and RUN_DIRECTORY and report.when != "teardown":
            filename = hashlib.sha256(item.nodeid.encode()).hexdigest()[:12] + ".png"
            try:
                driver.save_screenshot(str(RUN_DIRECTORY / filename))
                result["screenshot"] = filename
            except WebDriverException:
                result["screenshot"] = "unavailable"
    elif report.skipped and result["status"] != "FAILED":
        result["status"] = "BLOCKED"
        result["error"] = str(report.longrepr)
    elif report.when == "call" and result["status"] not in ("FAILED", "BLOCKED"):
        result["status"] = "PASSED"
    result["finished"] = now()


def pytest_sessionfinish(session, exitstatus):
    if not RESULTS:
        return  # --collect-only must never be reported as executed tests.
    directory = RUN_DIRECTORY or Path(__file__).parent / "reports" / "blocked"
    cases = {}
    for case, filename in [("TC-73 / TC-UC032-01", "test_uc032_01.py"), ("TC-74 / TC-UC032-02", "test_uc032_02.py")]:
        rows = [r for r in RESULTS.values() if filename in r["test"]]
        expected = 1 if "01.py" in filename else 29
        statuses = {r["status"] for r in rows}
        cases[case] = ("FAILED" if "FAILED" in statuses else "BLOCKED" if "BLOCKED" in statuses else
                       "PASSED" if len(rows) == expected and statuses == {"PASSED"} else "PARTIAL / NOT_RUN")
    write_json(directory / "summary.json", {"cases": cases, "tests": list(RESULTS.values()), "finished": now()})
    rows = "".join(f'<tr><td>{html.escape(r["test"])}</td><td>{r["status"]}</td><td>{html.escape(r.get("error", ""))}</td>'
                   f'<td>{html.escape(r.get("screenshot", ""))}</td></tr>' for r in RESULTS.values())
    (directory / "report.html").write_text('<!doctype html><meta charset="utf-8"><title>UC032 QA results</title>'
        '<style>body{font:15px sans-serif;margin:2rem}td,th{border:1px solid #bbb;padding:8px}table{border-collapse:collapse}</style>'
        '<h1>UC032 Selenium results</h1><pre>' + html.escape(str(cases)) + '</pre>'
        '<table><tr><th>Scenario</th><th>Status</th><th>Reason</th><th>Screenshot file</th></tr>' + rows + '</table>', encoding="utf-8")
    if any(r["status"] == "BLOCKED" for r in RESULTS.values()) and session.exitstatus == 0:
        session.exitstatus = 2
