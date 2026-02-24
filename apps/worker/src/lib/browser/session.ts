import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import type { BrowserAction } from "@persona-lab/shared";
import type { InteractiveElement } from "./extract-elements.js";
import { findScrollContainerScript, buildScrollScript, type ScrollContainerInfo } from "./scroll.js";

const NAVIGATION_TIMEOUT_MS = 15_000;

export class BrowserSession {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  public page: Page | null = null;

  /**
   * Launch a local Chromium instance directly via Playwright.
   * No Docker required — ideal for local development.
   */
  async launch(options?: { headless?: boolean }): Promise<void> {
    this.browser = await chromium.launch({
      headless: options?.headless ?? false,
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
    const t0 = Date.now();
    console.log(`[browser] navigating to ${url}`);
    await this.page!.goto(url, { waitUntil: "domcontentloaded" });
    await this.waitForSettle();
    console.log(`[browser] navigation settled in ${Date.now() - t0}ms → ${this.page!.url()}`);
  }

  async screenshot(): Promise<Buffer> {
    this.ensurePage();
    // Use an explicit 30s timeout — the global setDefaultTimeout(10s) is too short
    // for slow pages, and "waiting for fonts to load" can push past 10s.
    return Buffer.from(await this.page!.screenshot({ type: "png", fullPage: false, timeout: 30_000 }));
  }

  async executeAction(action: BrowserAction, elements: InteractiveElement[]): Promise<void> {
    this.ensurePage();
    const page = this.page!;
    const t0 = Date.now();

    switch (action.type) {
      case "click": {
        const el = elements[action.elementIndex];
        if (!el) throw new Error(`Element index ${action.elementIndex} out of range (have ${elements.length} elements)`);
        const x = el.bbox.x + el.bbox.width / 2;
        const y = el.bbox.y + el.bbox.height / 2;
        // Safety: refuse to click at obviously off-screen coordinates
        if (x < 0 || y < 0 || x > 2000 || y > 2000) {
          throw new Error(`Element[${action.elementIndex}] has off-screen coordinates (${Math.round(x)}, ${Math.round(y)}) — skipping click`);
        }
        console.log(`[browser] click element[${action.elementIndex}] "${el.text?.slice(0, 40) || el.tag}" at (${Math.round(x)}, ${Math.round(y)}) inViewport=${el.inViewport}`);
        await page.mouse.click(x, y);
        await this.waitForSettle();
        const newUrl = page.url();
        console.log(`[browser] click settled in ${Date.now() - t0}ms → ${newUrl}`);
        break;
      }

      case "type": {
        const el = elements[action.elementIndex];
        if (!el) throw new Error(`Element index ${action.elementIndex} out of range (have ${elements.length} elements)`);
        const x = el.bbox.x + el.bbox.width / 2;
        const y = el.bbox.y + el.bbox.height / 2;
        console.log(`[browser] type into element[${action.elementIndex}] "${el.text?.slice(0, 30) || el.placeholder || el.tag}" text="${action.text}" submit=${action.submit}`);
        // Triple-click to select all existing text (works on both Mac and Linux/Docker)
        await page.mouse.click(x, y, { clickCount: 3 });
        await page.keyboard.press("Backspace");
        await page.keyboard.type(action.text, { delay: 30 });
        if (action.submit) {
          await page.keyboard.press("Enter");
          await this.waitForSettle();
        }
        console.log(`[browser] type done in ${Date.now() - t0}ms`);
        break;
      }

      case "scroll": {
        const vp = page.viewportSize() ?? { width: 1280, height: 800 };
        const delta = action.direction === "down"
          ? Math.round(vp.height * 0.65)
          : -Math.round(vp.height * 0.65);

        console.log(`[browser] scroll ${action.direction} delta=${delta}px`);
        const pixelsScrolled: number = await page.evaluate(buildScrollScript(delta));

        if (pixelsScrolled === 0) {
          console.log(`[browser] scroll: JS scroll returned 0, falling back to mouse wheel`);
          await page.mouse.move(vp.width / 2, vp.height / 2);
          await page.mouse.wheel(0, delta);
        } else {
          console.log(`[browser] scroll: moved ${pixelsScrolled}px`);
        }

        await new Promise((r) => setTimeout(r, 500));
        break;
      }

      case "scroll_to": {
        const el = elements[action.elementIndex];
        if (!el) throw new Error(`Element index ${action.elementIndex} out of range (have ${elements.length} elements)`);
        const vp = page.viewportSize() ?? { width: 1280, height: 800 };

        if (el.bbox.y >= 0 && el.bbox.y + el.bbox.height <= vp.height) {
          console.log(`[browser] scroll_to element[${action.elementIndex}] — already in viewport, skipping`);
          break;
        }

        const elCenter = el.bbox.y + el.bbox.height / 2;
        const delta = Math.round(elCenter - vp.height / 2);

        if (Math.abs(delta) < 10) {
          console.log(`[browser] scroll_to element[${action.elementIndex}] — delta too small (${delta}px), skipping`);
          break;
        }

        console.log(`[browser] scroll_to element[${action.elementIndex}] "${el.text?.slice(0, 30) || el.tag}" delta=${delta}px`);
        const pixelsScrolled: number = await page.evaluate(buildScrollScript(delta));

        if (pixelsScrolled === 0) {
          console.log(`[browser] scroll_to: JS scroll returned 0, falling back to mouse wheel`);
          await page.mouse.move(vp.width / 2, vp.height / 2);
          await page.mouse.wheel(0, delta);
        }

        await new Promise((r) => setTimeout(r, 500));
        break;
      }

      case "navigate_back": {
        console.log(`[browser] navigate_back from ${page.url()}`);
        await page.goBack({ waitUntil: "domcontentloaded" }).catch(() => {});
        await this.waitForSettle();
        console.log(`[browser] navigate_back → ${page.url()} (${Date.now() - t0}ms)`);
        break;
      }

      case "wait": {
        console.log(`[browser] wait 2s — reason: ${(action as { reason?: string }).reason ?? "unspecified"}`);
        await new Promise((r) => setTimeout(r, 2000));
        break;
      }

      case "done": {
        console.log(`[browser] done — success=${(action as { success?: boolean }).success} reason="${(action as { reason?: string }).reason ?? ""}"`);
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
   * Uses the shared scroll-container detection so it's consistent with scroll execution.
   */
  async getScrollInfo(): Promise<{ scrollY: number; viewportHeight: number; pageHeight: number }> {
    this.ensurePage();
    const info: ScrollContainerInfo = await this.page!.evaluate(findScrollContainerScript);
    return {
      scrollY: info.scrollTop,
      viewportHeight: info.clientHeight,
      pageHeight: info.scrollHeight,
    };
  }

  /**
   * Detect if a fullscreen modal/overlay/lightbox is covering the page.
   * Uses semantic checks (role="dialog", aria-modal) and a geometric check
   * (large fixed-position element covering most of the viewport).
   */
  async detectOverlay(): Promise<boolean> {
    this.ensurePage();
    return this.page!.evaluate(() => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // 1. Semantic: role="dialog", aria-modal, <dialog open>
      const dialogs = document.querySelectorAll(
        '[role="dialog"], [aria-modal="true"], dialog[open]'
      );
      for (const d of dialogs) {
        const el = d as HTMLElement;
        if (el.offsetWidth > 100 && el.offsetHeight > 100) return true;
      }

      // 2. Geometric: check element at viewport center, walk up to find
      //    a large fixed-position ancestor (covers lightboxes, zoom modals, etc.)
      const centerEl = document.elementFromPoint(vw / 2, vh / 2);
      if (!centerEl) return false;

      let node: Element | null = centerEl;
      while (node && node !== document.body && node !== document.documentElement) {
        const style = window.getComputedStyle(node);
        if (style.position === "fixed") {
          const rect = node.getBoundingClientRect();
          if (rect.width >= vw * 0.7 && rect.height >= vh * 0.7) {
            return true;
          }
        }
        node = node.parentElement;
      }

      return false;
    });
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
