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
