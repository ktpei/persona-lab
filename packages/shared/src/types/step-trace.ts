import { z } from "zod";
import { Action, BrowserAction } from "./action.js";

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

// Agent-mode reasoning output — includes concrete browser action + abstract intent
export const AgentReasoningOutput = z.object({
  salient: z.string(),
  confusions: z.array(Confusion),
  browserAction: BrowserAction,
  intent: Action,
  confidence: z.number().min(0).max(1),
  friction: z.number().min(0).max(1),
  dropoffRisk: z.number().min(0).max(1),
  memoryUpdate: z.string().optional(),
  completesGoal: z.boolean().optional(),
});

export type AgentReasoningOutput = z.infer<typeof AgentReasoningOutput>;
