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
  inViewport: boolean;
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
 *
 * Elements are annotated with `inViewport` so the prompt can distinguish
 * clickable elements from those that require scrolling first.
 */
export async function extractInteractiveElements(
  page: Page,
  viewportHeight = 800,
): Promise<InteractiveElement[]> {
  const elements: InteractiveElement[] = [];
  const maxY = viewportHeight * 5; // cap off-screen extraction

  const handles = await page.$$(INTERACTIVE_SELECTOR);

  for (const handle of handles) {
    try {
      const bbox = await handle.boundingBox();
      // Skip elements that aren't visible or have no size
      if (!bbox || bbox.width < 4 || bbox.height < 4) continue;

      // Skip elements way outside the viewport (including off-screen hidden elements)
      if (bbox.y > maxY || bbox.x > 5000 || bbox.x < -100 || bbox.y < -100) continue;

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

      const viewportWidth = 1280;
      const inViewport =
        bbox.x + bbox.width > 0 && bbox.x < viewportWidth &&
        bbox.y + bbox.height > 0 && bbox.y < viewportHeight;

      elements.push({
        index: elements.length,
        ...info,
        bbox: { x: Math.round(bbox.x), y: Math.round(bbox.y), width: Math.round(bbox.width), height: Math.round(bbox.height) },
        inViewport,
      });
    } catch {
      // Element may have been detached
      continue;
    }
  }

  const inVP = elements.filter(e => e.inViewport).length;
  const belowVP = elements.filter(e => !e.inViewport && e.bbox.y >= viewportHeight).length;
  const aboveVP = elements.filter(e => !e.inViewport && e.bbox.y + e.bbox.height < 0).length;
  console.log(`[elements] Extracted ${elements.length} interactive elements (${inVP} in viewport, ${belowVP} below, ${aboveVP} above)`);

  return elements;
}

/**
 * Format a single element as a text line for the LLM prompt.
 */
function formatSingleElement(el: InteractiveElement): string {
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
}

/**
 * Format interactive elements as a sectioned text list for the LLM prompt.
 *
 * Splits elements into "In Viewport" (clickable now) and "Below/Above
 * Viewport" (need scroll_to first) so the agent doesn't try to click
 * off-screen elements.
 */
export function formatElementList(
  elements: InteractiveElement[],
  viewportHeight = 800,
): string {
  if (elements.length === 0) return "(No interactive elements found on this page)";

  const inVP = elements.filter((el) => el.inViewport);
  const below = elements.filter((el) => !el.inViewport && el.bbox.y >= viewportHeight);
  const above = elements.filter((el) => !el.inViewport && el.bbox.y + el.bbox.height < 0);

  const lines: string[] = [];

  if (inVP.length > 0) {
    lines.push("### In Viewport (clickable now)");
    for (const el of inVP) lines.push(formatSingleElement(el));
  }

  if (below.length > 0) {
    lines.push("");
    lines.push(`### Below Viewport (${below.length} elements — use scroll_to [index] to reach)`);
    for (const el of below) lines.push(formatSingleElement(el));
  }

  if (above.length > 0) {
    lines.push("");
    lines.push(`### Above Viewport (${above.length} elements — scroll up to reach)`);
    for (const el of above) lines.push(formatSingleElement(el));
  }

  return lines.join("\n");
}
