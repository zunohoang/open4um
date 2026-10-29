from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


class LoginPage:
    def __init__(self, driver, web_url):
        self.driver = driver
        self.web_url = web_url
        self.wait = WebDriverWait(driver, 20)

    def login(self, email, password):
        self.driver.get(self.web_url)
        self.wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, 'input[type="email"]'))).send_keys(email)
        self.driver.find_element(By.CSS_SELECTOR, 'input[type="password"]').send_keys(password)
        self.driver.find_element(By.CSS_SELECTOR, 'button[type="submit"]').click()
        self.wait.until(EC.url_contains("/admin"))
