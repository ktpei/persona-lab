import type { Page } from "playwright-core";

export interface InteractiveElement {
  index: number;
  tag: string;
  role: string | null;
  text: string;
  type: string | null;       // input type (text, email, password, etc.)
  placeholder: string | null;
  href: string | null;
  bbox: { x: number; y: number; width: number; height: number };
}

const MAX_ELEMENTS = 50;

function normalizeKey(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 40);
}

function normalizeHref(href: string | null): string {
  if (!href || href === "#") return "";
  try {
    const url = new URL(href, "http://x");
    return url.pathname.slice(0, 50);
  } catch {
    return href.slice(0, 50);
  }
}

function deduplicateElements(
  elements: InteractiveElement[],
  keyFn: (el: InteractiveElement) => string,
  maxPerGroup: number,
): InteractiveElement[] {
  const counts = new Map<string, number>();
  const result: InteractiveElement[] = [];
  for (const el of elements) {
    const key = keyFn(el);
    const n = counts.get(key) ?? 0;
    if (n < maxPerGroup) {
      result.push(el);
      counts.set(key, n + 1);
    }
  }
  return result;
}

/**
 * Prioritize and cap the element list before sending to the LLM.
 *
 * Priority order:
 *   1. Form controls (input, select, textarea) — always kept
 *   2. Buttons — deduped by text, max 2 per unique label
 *   3. In-viewport links — deduped by (text, href path), max 2 per group
 *   4. Out-of-viewport links — deduped more aggressively, max 1 per group
 *
 * Capped at MAX_ELEMENTS total, then re-indexed from 0.
 */
export function prioritizeElements(
  elements: InteractiveElement[],
  viewportHeight: number,
  max = MAX_ELEMENTS,
): { elements: InteractiveElement[]; totalOriginal: number } {
  const totalOriginal = elements.length;

  const formControls = elements.filter((e) =>
    ["input", "select", "textarea"].includes(e.tag)
  );

  const buttons = elements.filter(
    (e) =>
      (e.tag === "button" || e.role === "button") &&
      !["input", "select", "textarea"].includes(e.tag)
  );

  const links = elements.filter(
    (e) =>
      !["input", "select", "textarea", "button"].includes(e.tag) &&
      e.role !== "button"
  );

  const dedupedButtons = deduplicateElements(
    buttons,
    (el) => normalizeKey(el.text),
    2,
  );

  const inViewLinks = links.filter((e) => e.bbox.y >= 0 && e.bbox.y < viewportHeight);
  const outLinks = links.filter((e) => e.bbox.y < 0 || e.bbox.y >= viewportHeight);

  const dedupedInView = deduplicateElements(
    inViewLinks,
    (el) => normalizeKey(el.text) + "|" + normalizeHref(el.href),
    2,
  );

  const dedupedOut = deduplicateElements(
    outLinks,
    (el) => normalizeKey(el.text) + "|" + normalizeHref(el.href),
    1,
  );

  const combined = [
    ...formControls,
    ...dedupedButtons,
    ...dedupedInView,
    ...dedupedOut,
  ].slice(0, max);

  const reindexed = combined.map((el, i) => ({ ...el, index: i }));
  return { elements: reindexed, totalOriginal };
}

const INTERACTIVE_SELECTOR = [
  "a[href]",
  "button",
  "input:not([type=hidden])",
  "select",
  "textarea",
  "[role='button']",
  "[role='link']",
  "[role='tab']",
  "[role='menuitem']",
  "[role='checkbox']",
  "[role='radio']",
].join(", ");

/**
 * Extract interactive elements from the current page with bounding boxes.
 * Returns a numbered list suitable for sending to the LLM.
 */
export async function extractInteractiveElements(page: Page): Promise<InteractiveElement[]> {
  const elements: InteractiveElement[] = [];

  const handles = await page.$$(INTERACTIVE_SELECTOR);

  for (const handle of handles) {
    try {
      const bbox = await handle.boundingBox();
      // Skip elements that aren't visible or have no size
      if (!bbox || bbox.width < 4 || bbox.height < 4) continue;

      // Skip elements outside the viewport (roughly)
      if (bbox.y > 5000 || bbox.x > 5000) continue;

      const info = await handle.evaluate((el: Element) => {
        const htmlEl = el as HTMLElement;
        return {
          tag: el.tagName.toLowerCase(),
          role: el.getAttribute("role"),
          text: (htmlEl.innerText || el.getAttribute("aria-label") || el.getAttribute("alt") || "").trim().slice(0, 80),
          type: el.getAttribute("type"),
          placeholder: el.getAttribute("placeholder"),
          href: el.getAttribute("href"),
        };
      });

      elements.push({
        index: elements.length,
        ...info,
        bbox: { x: Math.round(bbox.x), y: Math.round(bbox.y), width: Math.round(bbox.width), height: Math.round(bbox.height) },
      });
    } catch {
      // Element may have been detached
      continue;
    }
  }

  return elements;
}

/**
 * Format interactive elements as a numbered text list for the LLM prompt.
 * Pass totalOriginal to append a note when the list was trimmed.
 */
export function formatElementList(elements: InteractiveElement[], totalOriginal?: number): string {
  if (elements.length === 0) return "(No interactive elements found on this page)";

  const lines = elements.map((el) => {
    const parts: string[] = [];

    // Tag/role description
    if (el.role) {
      parts.push(`${el.tag}[role="${el.role}"]`);
    } else if (el.tag === "input" && el.type) {
      parts.push(`Input[${el.type}]`);
    } else {
      parts.push(el.tag.charAt(0).toUpperCase() + el.tag.slice(1));
    }

    // Text content
    if (el.text) {
      parts.push(`"${el.text}"`);
    } else if (el.placeholder) {
      parts.push(`placeholder="${el.placeholder}"`);
    }

    // Link destination
    if (el.href && el.href !== "#") {
      const short = el.href.length > 50 ? el.href.slice(0, 47) + "..." : el.href;
      parts.push(`→ ${short}`);
    }

    // Bounding box
    parts.push(`(${el.bbox.x}, ${el.bbox.y}, ${el.bbox.width}x${el.bbox.height})`);

    return `[${el.index}] ${parts.join(" ")}`;
  });

  if (totalOriginal != null && totalOriginal > elements.length) {
    lines.push(`(${totalOriginal - elements.length} additional elements hidden — deduplicated/trimmed to reduce noise)`);
  }

  return lines.join("\n");
}
