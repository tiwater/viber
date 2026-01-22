from playwright.sync_api import sync_playwright

def verify():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        # Check Homepage
        page.goto("http://localhost:6007")
        header_height_home = page.evaluate("() => document.querySelector('header').offsetHeight")
        print(f"Homepage Header Height: {header_height_home}px")
        page.screenshot(path="homepage_after.png", full_page=True)

        # Check Docs Page
        page.goto("http://localhost:6007/getting-started/installation/")
        header_height_docs = page.evaluate("() => document.querySelector('header').offsetHeight")
        print(f"Docs Header Height: {header_height_docs}px")
        page.screenshot(path="docs_after.png", full_page=True)

        browser.close()

if __name__ == "__main__":
    verify()
