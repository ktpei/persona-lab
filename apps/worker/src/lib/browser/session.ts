import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import type { BrowserAction } from "@persona-lab/shared";
import type { InteractiveElement } from "./extract-elements.js";

const NAVIGATION_TIMEOUT_MS = 15_000;

export class BrowserSession {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  public page: Page | null = null;

  /**
   * Launch a local headless Chromium instance directly via Playwright.
   * No Docker required — ideal for local development.
   */
  async launch(options?: { headless?: boolean }): Promise<void> {
    this.browser = await chromium.launch({
      headless: options?.headless ?? true,
      args: [
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--disable-background-networking",
        "--disable-default-apps",
        "--disable-extensions",
        "--disable-sync",
        "--no-first-run",
      ],
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    });

    this.page = await this.context.newPage();
    this.page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MS);
    this.page.setDefaultTimeout(10_000);
  }

  /**
   * Connect to an existing browser via CDP endpoint (for Docker / remote browsers).
   */
  async connect(cdpEndpoint: string): Promise<void> {
    this.browser = await chromium.connectOverCDP(cdpEndpoint);
    const contexts = this.browser.contexts();
    this.context = contexts[0] ?? await this.browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const pages = this.context.pages();
    this.page = pages[0] ?? await this.context.newPage();

    await this.page.setViewportSize({ width: 1280, height: 800 });
    this.page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MS);
    this.page.setDefaultTimeout(10_000);
  }

  async navigate(url: string): Promise<void> {
    this.ensurePage();
    await this.page!.goto(url, { waitUntil: "domcontentloaded" });
    await this.waitForSettle();
  }

  async screenshot(): Promise<Buffer> {
    this.ensurePage();
    return Buffer.from(await this.page!.screenshot({ type: "png", fullPage: false }));
  }

  async executeAction(action: BrowserAction, elements: InteractiveElement[], pageHeight?: number): Promise<void> {
    this.ensurePage();
    const page = this.page!;

    switch (action.type) {
      case "click": {
        const el = elements[action.elementIndex];
        if (!el) throw new Error(`Element index ${action.elementIndex} out of range`);
        const x = el.bbox.x + el.bbox.width / 2;
        const y = el.bbox.y + el.bbox.height / 2;
        await page.mouse.click(x, y);
        await this.waitForSettle();
        break;
      }

      case "click_coordinates": {
        await page.mouse.click(action.x, action.y);
        await this.waitForSettle();
        break;
      }

      case "type": {
        const el = elements[action.elementIndex];
        if (!el) throw new Error(`Element index ${action.elementIndex} out of range`);
        const x = el.bbox.x + el.bbox.width / 2;
        const y = el.bbox.y + el.bbox.height / 2;
        await page.mouse.click(x, y);
        await page.keyboard.press("Meta+A");
        await page.keyboard.press("Backspace");
        await page.keyboard.type(action.text, { delay: 30 });
        if (action.submit) {
          await page.keyboard.press("Enter");
          await this.waitForSettle();
        }
        break;
      }

      case "scroll": {
        const amount = action.amount ?? 0.3;
        const height = pageHeight ?? 3000;
        const delta = Math.round(amount * height) * (action.direction === "down" ? 1 : -1);
        await page.mouse.wheel(0, delta);
        await new Promise((r) => setTimeout(r, 800)); // wait for lazy-loaded content
        break;
      }

      case "navigate_back": {
        await page.goBack({ waitUntil: "domcontentloaded" }).catch(() => {});
        await this.waitForSettle();
        break;
      }

      case "wait": {
        await new Promise((r) => setTimeout(r, 2000));
        break;
      }

      case "done": {
        break;
      }
    }
  }

  async getUrl(): Promise<string> {
    this.ensurePage();
    return this.page!.url();
  }

  async getTitle(): Promise<string> {
    this.ensurePage();
    return this.page!.title();
  }

  /**
   * Get current scroll position, viewport height, and total page height.
   * Lets the agent know how much of the page it has seen.
   */
  async getScrollInfo(): Promise<{ scrollY: number; viewportHeight: number; pageHeight: number }> {
    this.ensurePage();
    return this.page!.evaluate(() => ({
      scrollY: Math.round(window.scrollY),
      viewportHeight: window.innerHeight,
      pageHeight: document.documentElement.scrollHeight,
    }));
  }

  async close(): Promise<void> {
    if (this.context) {
      await this.context.close().catch(() => {});
      this.context = null;
      this.page = null;
    }
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }

  private ensurePage(): void {
    if (!this.page) throw new Error("BrowserSession not started — call launch() or connect() first");
  }

  private async waitForSettle(): Promise<void> {
    try {
      await this.page!.waitForLoadState("networkidle", { timeout: 5000 });
    } catch {
      // Timeout is fine — some pages never fully settle
    }
    await new Promise((r) => setTimeout(r, 300));
  }
}
