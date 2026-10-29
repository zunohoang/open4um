"""Capture the actual UI state at the action, before refresh or fixture cleanup."""
from __future__ import annotations

import json
import re
import struct
from pathlib import Path
from urllib.parse import urlsplit

from evidence_support import digest, safe_data, safe_url
from qa_support import now, write_json


class EvidenceError(AssertionError):
    pass


class StepEvidence:
    def __init__(self, driver, directory, row, secrets=(), changed=None):
        self.driver = driver
        self.directory = Path(directory)
        self.row = row
        self.secrets = secrets
        self.changed = changed or (lambda: None)
        self.sequence = 0
        self.pending = {}
        self.transactions = []
        self.driver.get_log("performance")  # Drop login traffic; never persist tokens.

    def begin_action(self):
        self.network()
        self.transactions = []

    def network(self):
        """Keep only Credit GET/PATCH traffic; raw browser logs are never written."""
        for entry in self.driver.get_log("performance"):
            message = json.loads(entry["message"])["message"]
            params = message.get("params", {})
            request_id = params.get("requestId")
            if message["method"] == "Network.requestWillBeSent":
                request = params["request"]
                if urlsplit(request["url"]).path != "/api/v1/admin/credit-config":
                    continue
                transaction = {"method": request["method"], "url": safe_url(request["url"]),
                               "startedMonotonic": params.get("timestamp"), "observed": now()}
                if request.get("postData"):
                    try:
                        transaction["requestBody"] = safe_data(json.loads(request["postData"]), self.secrets)
                    except ValueError:
                        transaction["requestBody"] = "Unparseable payload"
                self.pending[request_id] = transaction
                self.transactions.append(transaction)
            elif request_id in self.pending:
                transaction = self.pending[request_id]
                if message["method"] == "Network.responseReceived":
                    response = params["response"]
                    transaction["httpStatus"] = response["status"]
                elif message["method"] == "Network.loadingFinished":
                    if transaction.get("startedMonotonic") is not None:
                        transaction["durationMs"] = round((params["timestamp"] - transaction["startedMonotonic"]) * 1000, 2)
                    try:
                        response = self.driver.execute_cdp_cmd("Network.getResponseBody", {"requestId": request_id})
                        transaction["responseBody"] = safe_data(json.loads(response["body"]), self.secrets)
                    except Exception as error:
                        transaction["bodyCapture"] = type(error).__name__
                    self.pending.pop(request_id)
                elif message["method"] == "Network.loadingFailed":
                    transaction["transportError"] = params.get("errorText", "Unknown transport error")
                    self.pending.pop(request_id)
        return safe_data(self.transactions, self.secrets)

    def capture(self, stage, label, values=None, expected=None, input_data=None, readback=None, required_feedback=None):
        self.sequence += 1
        feedback = self.driver.execute_script("""
          return Array.from(document.querySelectorAll('[role="alert"], label [class*="text-red"]'))
           .filter(n => n.getClientRects().length && getComputedStyle(n).visibility!=='hidden')
           .map(n => n.innerText).filter(Boolean);
        """)
        viewport = self.driver.execute_script("return {width:innerWidth,height:innerHeight,scrollX:scrollX,scrollY:scrollY,dpr:devicePixelRatio}")
        png = self.driver.get_screenshot_as_png()
        if png[:8] != b"\x89PNG\r\n\x1a\n":
            raise EvidenceError("Browser did not return a PNG screenshot")
        width, height = struct.unpack(">II", png[16:24])
        stem = digest(self.row["test"].encode())[:12]
        slug = re.sub(r"[^a-z0-9-]", "-", stage.lower())[:35]
        relative = f"images/{stem}/{self.sequence:03d}-{slug}.png"
        image = self.directory / relative
        image.parent.mkdir(parents=True, exist_ok=True)
        image.write_bytes(png)
        checkpoint = {"sequence": self.sequence, "stage": stage, "label": label, "captured": now(),
            "url": safe_url(self.driver.current_url), "expected": expected, "observed": values,
            "input": input_data, "feedback": feedback, "viewport": viewport,
            "artifacts": [{"path": relative, "role": "unmodified viewport", "sha256": digest(png),
                           "width": width, "height": height}], "network": self.network()}
        if readback is not None:
            checkpoint["readback"] = readback
        # Check feedback remained visible across the screenshot call. A post-test
        # screenshot without the required message is not sufficient evidence.
        if required_feedback:
            after = self.driver.execute_script("return Array.from(document.querySelectorAll('[role=alert], label [class*=text-red]')).filter(n=>n.getClientRects().length).map(n=>n.innerText)")
            visible = any(required_feedback in text for text in feedback) and any(required_feedback in text for text in after)
            checkpoint["requiredFeedback"] = {"text": required_feedback, "visibleAcrossCapture": visible}
        self.row.setdefault("checkpoints", []).append(safe_data(checkpoint, self.secrets))
        write_json(self.directory / f"checkpoints/{stem}-{self.sequence:03d}.json", self.row["checkpoints"][-1])
        self.changed()
        if required_feedback and not checkpoint["requiredFeedback"]["visibleAcrossCapture"]:
            raise EvidenceError("Required application feedback was not visible across screenshot capture: " + required_feedback)
        return checkpoint


def missing_evidence(row):
    checkpoints = row.get("checkpoints", [])
    stages = {c["stage"] for c in checkpoints}
    required = {"attempted-input", "persistence"}
    if "test_valid_credit_changes_persist" in row["test"]:
        required.add("save-feedback")
        if sum(c["stage"] == "save-feedback" for c in checkpoints) < 6:
            return ["All five valid changes and the UI restoration need success-feedback captures"]
    elif "test_mixed_validity_then_correction" in row["test"]:
        required |= {"validation-feedback", "save-feedback"}
    else:
        required.add("validation-feedback" if "input-blocked" not in stages else "input-blocked")
    missing = sorted(required - stages)
    if not all(c.get("artifacts") for c in checkpoints):
        missing.append("Screenshot missing from a checkpoint")
    if not any(c.get("readback") for c in checkpoints if c["stage"] == "persistence"):
        missing.append("Independent persisted readback")
    if any(c.get("requiredFeedback", {}).get("visibleAcrossCapture") is not True
           for c in checkpoints if c["stage"] in {"save-feedback", "validation-feedback"}):
        missing.append("Application feedback was not visibly captured")
    return missing
