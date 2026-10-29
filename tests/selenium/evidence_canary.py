"""Explicitly launched harness diagnostic; excluded from ordinary test discovery.

This deliberately fails after a real validation rejection to check failure
capture and recovery. It is not an application defect or a Kiwi execution.
"""


def test_intentional_failure_capture(credit_page):
    credit_page.enter("pricePerSlide", "1.5")
    credit_page.expect_rejection("pricePerSlide")
    assert False, "INTENTIONAL HARNESS CANARY: verify failure screenshot and recovery; not an application defect."
