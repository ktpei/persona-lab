/**
 * Shared scroll helpers for browser automation.
 *
 * Centralises scroll-container detection and scroll execution so that
 * `BrowserSession.executeAction` and `BrowserSession.getScrollInfo` use
 * identical logic.  All public exports are **JS source strings** intended
 * for `page.evaluate()`.
 */

// ---------------------------------------------------------------------------
// Types returned by the in-browser scripts
// ---------------------------------------------------------------------------

export interface ScrollContainerInfo {
  /** 'window' if the document body scrolls, 'container' if a nested element, 'none' if nothing scrollable */
  type: "window" | "container" | "none";
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

// ---------------------------------------------------------------------------
// Container detection  (used by both getScrollInfo and scroll execution)
// ---------------------------------------------------------------------------

/**
 * JS source that, when evaluated in the browser, returns a
 * `ScrollContainerInfo` describing the page's primary scroll container.
 *
 * Improvements over the previous `querySelectorAll("*")` approach:
 *  - Uses TreeWalker — O(n) without allocating a massive array
 *  - Detects `overflow-y: overlay` (modern CSS)
 *  - Skips narrow containers (< 50 % viewport width) to avoid sidebars
 */
export const findScrollContainerScript = `
(() => {
  // 1. Check if the document itself scrolls
  if (document.documentElement.scrollHeight > window.innerHeight + 10) {
    return {
      type: "window",
      scrollTop: Math.round(window.scrollY),
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: window.innerHeight,
    };
  }

  // 2. Walk the DOM for the main scrollable container
  const minWidth = window.innerWidth * 0.5;
  let best = null;
  let bestArea = 0;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, null);
  let node = walker.nextNode();
  while (node) {
    const style = getComputedStyle(node);
    const oy = style.overflowY;
    if (oy === "auto" || oy === "scroll" || oy === "overlay") {
      if (node.scrollHeight > node.clientHeight + 10) {
        const rect = node.getBoundingClientRect();
        if (rect.width >= minWidth) {
          const area = rect.width * rect.height;
          if (area > bestArea) { bestArea = area; best = node; }
        }
      }
    }
    node = walker.nextNode();
  }

  if (best) {
    return {
      type: "container",
      scrollTop: Math.round(best.scrollTop),
      scrollHeight: best.scrollHeight,
      clientHeight: best.clientHeight,
    };
  }

  return {
    type: "none",
    scrollTop: 0,
    scrollHeight: window.innerHeight,
    clientHeight: window.innerHeight,
  };
})()
`;

// ---------------------------------------------------------------------------
// Scroll execution
// ---------------------------------------------------------------------------

/**
 * Build a JS source string that scrolls the page by `delta` pixels.
 * Returns the **actual number of pixels scrolled** (0 if nothing moved).
 *
 * Strategy:
 *  1. Try `window.scrollBy` (standard document scroll)
 *  2. If window didn't move, find the main scrollable container and
 *     adjust its `scrollTop`
 *  3. After any successful scroll, dispatch a `scroll` Event so that
 *     lazy-loaders / infinite-scroll handlers fire
 */
export function buildScrollScript(delta: number): string {
  return `
(() => {
  const d = ${delta};

  // --- Try document scroll ---
  if (document.documentElement.scrollHeight > window.innerHeight + 10) {
    const before = window.scrollY;
    window.scrollBy(0, d);
    const after = window.scrollY;
    if (after !== before) {
      window.dispatchEvent(new Event("scroll"));
      return Math.round(after - before);
    }
  }

  // --- Find the main scrollable container ---
  const minWidth = window.innerWidth * 0.5;
  let best = null;
  let bestArea = 0;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, null);
  let node = walker.nextNode();
  while (node) {
    const style = getComputedStyle(node);
    const oy = style.overflowY;
    if (oy === "auto" || oy === "scroll" || oy === "overlay") {
      if (node.scrollHeight > node.clientHeight + 10) {
        const rect = node.getBoundingClientRect();
        if (rect.width >= minWidth) {
          const area = rect.width * rect.height;
          if (area > bestArea) { bestArea = area; best = node; }
        }
      }
    }
    node = walker.nextNode();
  }

  if (best) {
    const before = best.scrollTop;
    best.scrollTop += d;
    const after = best.scrollTop;
    if (after !== before) {
      best.dispatchEvent(new Event("scroll", { bubbles: true }));
      return Math.round(after - before);
    }
  }

  return 0;
})()
`;
}
