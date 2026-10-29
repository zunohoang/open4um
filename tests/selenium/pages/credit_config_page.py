from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

LABELS = {
    "pricePerLecture": "Giá mỗi lượt sinh bài giảng",
    "pricePerSlide": "Giá mỗi slide tạo mới trong AI Chat",
    "pricePerAiEdit": "Giá mỗi lượt AI chỉnh sửa slide",
    "pricePerOutline": "Giá mỗi lượt AI sinh dàn ý",
    "signupBonus": "Credit tặng khi người dùng đăng ký mới",
}
SUCCESS = (By.XPATH, '//*[@role="alert"][contains(., "Đã lưu cấu hình credit thành công")]')


class CreditConfigPage:
    def __init__(self, driver, evidence=None, api=None):
        self.driver = driver
        self.wait = WebDriverWait(driver, 20)
        self.evidence = evidence
        self.api = api
        self.input_data = {}

    def open(self):
        self.wait.until(EC.element_to_be_clickable((
            By.XPATH, '//button[normalize-space(.)="Cấu hình Credit"]'))).click()
        for key in LABELS:
            self.wait.until(lambda _: self.field(key).is_displayed() and self.field(key).get_attribute("value") != "")
        return self

    def field(self, key):
        return self.driver.find_element(By.XPATH, f'//label[starts-with(normalize-space(.), "{LABELS[key]}")]/input')

    def values(self):
        return {key: self.field(key).get_attribute("value") for key in LABELS}

    def assert_values(self, expected, label="Persisted values after refresh", stage="persistence"):
        observed = self.values()
        readback = None
        if self.api:
            self.api.credit()
            readback = self.api.credit_observation
        if self.evidence:
            self.evidence.capture(stage, label, observed, expected, readback=readback)
        assert observed == {key: str(value) for key, value in expected.items()}, "Refreshed form differs from expected values"
        if readback:
            assert readback["body"] == expected, "Independent API readback differs from expected values"

    def enter(self, key, value):
        if self.evidence and not self.input_data:
            self.evidence.begin_action()
        element = self.field(key)
        element.click()
        element.send_keys(Keys.CONTROL, "a")
        element.send_keys(Keys.BACKSPACE)
        if value:
            element.send_keys(str(value))
        element.send_keys(Keys.TAB)
        observed = element.get_attribute("value")
        self.input_data[key] = {"attempted": value, "attemptedRepr": repr(value),
                                "observed": observed, "observedRepr": repr(observed)}
        return observed

    def capture_input(self, expected, label="Input immediately before Save"):
        if self.evidence:
            self.evidence.capture("attempted-input", label, self.values(), expected, input_data=self.input_data)

    def dismiss_success(self):
        for toast in self.driver.find_elements(*SUCCESS):
            if toast.is_displayed():
                toast.find_element(By.CSS_SELECTOR, 'button[aria-label="Đóng thông báo"]').click()
        self.wait.until(EC.invisibility_of_element_located(SUCCESS))

    def save(self):
        self.dismiss_success()
        self.wait.until(EC.element_to_be_clickable((
            By.XPATH, '//button[normalize-space(.)="Lưu cấu hình"]'))).click()

    def save_successfully(self, expected=None, label="Save accepted with visible success toast"):
        self.capture_input(expected or {"outcome": "save accepted"})
        self.save()
        self.wait.until(EC.visibility_of_element_located(SUCCESS))
        if self.evidence:
            self.evidence.capture("save-feedback", label, self.values(), expected,
                                  input_data=self.input_data, required_feedback="Đã lưu cấu hình credit thành công")
        self.wait.until(EC.element_to_be_clickable((
            By.XPATH, '//button[normalize-space(.)="Lưu cấu hình"]')))
        self.input_data = {}

    def expect_rejection(self, key):
        self.capture_input({"outcome": "rejected", "invalidField": key})
        self.save()
        self.wait.until(lambda _: self.field(key).get_attribute("aria-invalid") == "true")
        label = self.field(key).find_element(By.XPATH, "..")
        assert "số nguyên dương" in label.text, "Missing positive-integer validation message"
        assert not any(t.is_displayed() for t in self.driver.find_elements(*SUCCESS)), "False success toast"
        if self.evidence:
            checkpoint = self.evidence.capture("validation-feedback", "Invalid " + key + " rejected before persistence",
                self.values(), {"outcome": "rejected", "invalidField": key},
                input_data=self.input_data, required_feedback="số nguyên dương")
            assert not any(t.get("method") == "PATCH" for t in checkpoint["network"]), "Invalid form unexpectedly sent a Credit update"
        self.input_data = {}

    def refresh(self):
        self.driver.refresh()
        return self.open()
