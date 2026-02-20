import { z } from "zod";

export const FindingData = z.object({
  issue: z.string(),
  evidence: z.string(),
  severity: z.number(),
  frequency: z.number().int(),
  affectedPersonas: z.array(z.string()),
  elementRef: z.string().optional(),
  stepIndex: z.number().int().optional(),
  screenIndex: z.number().int().optional(),
  recommendedFix: z.string().optional(),
});

export type FindingData = z.infer<typeof FindingData>;

export const ScreenStats = z.object({
  screenIndex: z.number().int(),
  avgFriction: z.number(),
  maxFriction: z.number(),
  avgDropoffRisk: z.number(),
  confusionCount: z.number().int(),
  findingCount: z.number().int(),
  totalSteps: z.number().int(),
});

export type ScreenStats = z.infer<typeof ScreenStats>;

export const ReportJson = z.object({
  summary: z.object({
    totalEpisodes: z.number(),
    completedEpisodes: z.number(),
    abandonedEpisodes: z.number(),
    avgFriction: z.number(),
    avgDropoffRisk: z.number(),
  }),
  findings: z.array(FindingData),
  perScreen: z.array(ScreenStats),
  perPersona: z.array(
    z.object({
      personaId: z.string(),
      personaName: z.string(),
      ageGroup: z.string().optional(),
      gender: z.string().optional(),
      traits: z.record(z.string(), z.number()).optional(),
      episodeStatus: z.string(),
      avgFriction: z.number(),
      avgConfidence: z.number(),
      stepsCount: z.number(),
      confusions: z.array(
        z.object({
          issue: z.string(),
          evidence: z.string(),
          stepIndex: z.number(),
          screenIndex: z.number().optional(),
        })
      ),
    })
  ),
});

export type ReportJson = z.infer<typeof ReportJson>;
