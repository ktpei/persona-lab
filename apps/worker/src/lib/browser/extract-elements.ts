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
 */
export function formatElementList(elements: InteractiveElement[]): string {
  if (elements.length === 0) return "(No interactive elements found on this page)";

  return elements.map((el) => {
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
  }).join("\n");
}
