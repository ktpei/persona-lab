import { z } from "zod";

export const Action = z.enum([
  "CLICK_PRIMARY_CTA",
  "CLICK_SECONDARY_CTA",
  "OPEN_NAV",
  "SCROLL",
  "BACK",
  "SEEK_INFO",
  "HESITATE",
  "ABANDON",
]);

export type Action = z.infer<typeof Action>;

// Browser agent actions — concrete actions executed by Playwright
export const BrowserAction = z.discriminatedUnion("type", [
  z.object({ type: z.literal("click"), elementIndex: z.number() }),
  z.object({ type: z.literal("click_coordinates"), x: z.number(), y: z.number() }),
  z.object({ type: z.literal("type"), elementIndex: z.number(), text: z.string() }),
  z.object({ type: z.literal("scroll"), direction: z.enum(["up", "down"]) }),
  z.object({ type: z.literal("navigate_back") }),
  z.object({ type: z.literal("wait"), reason: z.string() }),
  z.object({ type: z.literal("done"), success: z.boolean(), reason: z.string() }),
]);

export type BrowserAction = z.infer<typeof BrowserAction>;
