import pytest
from qa_support import BASELINE


@pytest.mark.uc032_01
def test_valid_credit_changes_persist(credit_page, qa_run):
    """TC-73: every original step, including the valid lower boundary and reset."""
    expected = dict(BASELINE)
    for key, value in [("pricePerSlide", 7), ("pricePerAiEdit", 3),
                       ("pricePerLecture", 81), ("pricePerOutline", 6), ("pricePerSlide", 1)]:
        credit_page.enter(key, str(value))
        expected[key] = value
        credit_page.save_successfully(expected, label=f"Saved {key} = {value}; success toast visible")
        credit_page.refresh().assert_values(expected)
        assert qa_run["api"].credit() == expected
    for key, value in BASELINE.items():
        credit_page.enter(key, str(value))
    credit_page.save_successfully(BASELINE, label="UI restoration accepted; success toast visible")
    credit_page.refresh().assert_values(BASELINE)
    assert qa_run["api"].credit() == BASELINE
