import { z } from "zod";

export const UIElement = z.object({
  label: z.string(),
  type: z.string(),
  position: z.string().optional(),
  description: z.string().optional(),
});

export type UIElement = z.infer<typeof UIElement>;

export const FrameParseResult = z.object({
  screenSummary: z.string(),
  elements: z.array(UIElement),
});

export type FrameParseResult = z.infer<typeof FrameParseResult>;
