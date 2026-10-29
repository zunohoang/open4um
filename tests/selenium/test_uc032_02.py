import pytest
from qa_support import BASELINE, COST_FIELDS

INVALID = [pytest.param("0", id="zero"), pytest.param("-1", id="negative"),
           pytest.param("1.5", id="decimal"), pytest.param("abc", id="letters"),
           pytest.param("5abc", id="mixed"), pytest.param("", id="empty"),
           pytest.param("   ", id="whitespace")]


@pytest.mark.uc032_02
@pytest.mark.parametrize("field", COST_FIELDS)
@pytest.mark.parametrize("invalid", INVALID)
def test_invalid_credit_rejected(credit_page, qa_run, field, invalid, record_property):
    """TC-74 A-G on each of the four AI cost fields."""
    observed = credit_page.enter(field, invalid)
    record_property("attempted_value", repr(invalid))
    record_property("observed_value", repr(observed))
    # The verified five-field UI uses text inputs and must retain invalid input
    # until validation. If the UI changes to input-blocking, require persistence
    # to stay unchanged; never silently treat coercion into another valid price as rejection.
    if observed != invalid and observed == str(BASELINE[field]):
        credit_page.capture_input({"outcome": "input blocked", "field": field})
        credit_page.evidence.capture("input-blocked", "Browser refused the invalid input", credit_page.values(),
            {"field": field, "attempted": invalid, "retained": BASELINE[field]}, input_data=credit_page.input_data)
        assert qa_run["api"].credit() == BASELINE
    else:
        credit_page.expect_rejection(field)
    credit_page.refresh().assert_values(BASELINE)
    assert qa_run["api"].credit() == BASELINE


@pytest.mark.uc032_02
def test_mixed_validity_then_correction(credit_page, qa_run):
    credit_page.enter("pricePerSlide", "6")
    credit_page.enter("pricePerAiEdit", "0")
    credit_page.expect_rejection("pricePerAiEdit")
    assert qa_run["api"].credit() == BASELINE, "Rejected update must not partially persist"
    credit_page.enter("pricePerAiEdit", "6")
    expected = {**BASELINE, "pricePerSlide": 6, "pricePerAiEdit": 6}
    credit_page.save_successfully(expected, label="Corrected values accepted; success toast visible")
    credit_page.refresh().assert_values(expected)
    assert qa_run["api"].credit() == expected
    for key, value in BASELINE.items():
        credit_page.enter(key, str(value))
    credit_page.save_successfully(BASELINE, label="UI restoration accepted; success toast visible")
    credit_page.refresh().assert_values(BASELINE)
