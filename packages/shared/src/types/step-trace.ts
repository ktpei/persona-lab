import { z } from "zod";
import { Action } from "./action.js";

export const Confusion = z.object({
  issue: z.string(),
  evidence: z.string(),
  elementRef: z.string().nullish(),
});

export type Confusion = z.infer<typeof Confusion>;

export const ReasoningOutput = z.object({
  salient: z.string(),
  confusions: z.array(Confusion),
  likelyAction: Action,
  confidence: z.number().min(0).max(1),
  friction: z.number().min(0).max(1),
  dropoffRisk: z.number().min(0).max(1),
  memoryUpdate: z.string().optional(),
});

export type ReasoningOutput = z.infer<typeof ReasoningOutput>;
