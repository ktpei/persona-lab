import { z } from "zod";

// ---------- Legacy (kept for backward compat) ----------

export const PersonaKnobs = z.object({
  patience: z.number().min(0).max(1),
  techSavviness: z.number().min(0).max(1),
  goalOrientation: z.number().min(0).max(1),
  explorationTendency: z.number().min(0).max(1),
  accessibilityNeeds: z.array(z.string()),
  customTraits: z.record(z.string(), z.number()),
});

export type PersonaKnobs = z.infer<typeof PersonaKnobs>;

// ---------- New OCEAN-backed traits ----------

export const AgeGroup = z.enum([
  "18-24",
  "25-34",
  "35-44",
  "45-54",
  "55-64",
  "65+",
]);
export type AgeGroup = z.infer<typeof AgeGroup>;

export const Gender = z.enum(["male", "female", "non-binary"]);
export type Gender = z.infer<typeof Gender>;

export const PersonaTraits = z.object({
  patience: z.number().min(0).max(1),
  exploration: z.number().min(0).max(1),
  frustrationSensitivity: z.number().min(0).max(1),
  forgiveness: z.number().min(0).max(1),
  helpSeeking: z.number().min(0).max(1),
});
export type PersonaTraits = z.infer<typeof PersonaTraits>;

export const TRAIT_LABELS: Record<keyof PersonaTraits, { label: string; ocean: string; lowDesc: string; highDesc: string }> = {
  patience: {
    label: "Patience",
    ocean: "Conscientiousness",
    lowDesc: "Abandons quickly",
    highDesc: "Pushes through",
  },
  exploration: {
    label: "Exploration",
    ocean: "Openness",
    lowDesc: "Sticks to familiar paths",
    highDesc: "Clicks around freely",
  },
  frustrationSensitivity: {
    label: "Frustration Sensitivity",
    ocean: "Neuroticism",
    lowDesc: "Calm when confused",
    highDesc: "Upset at friction",
  },
  forgiveness: {
    label: "Forgiveness",
    ocean: "Agreeableness",
    lowDesc: "Blames interface",
    highDesc: "Tries again",
  },
  helpSeeking: {
    label: "Help-Seeking",
    ocean: "Extraversion",
    lowDesc: "Struggles alone",
    highDesc: "Looks for support",
  },
};

// ---------- Persona Groups & Archetypes ----------

export const TraitRangeSchema = z.object({
  patience: z.tuple([z.number(), z.number()]),
  exploration: z.tuple([z.number(), z.number()]),
  frustrationSensitivity: z.tuple([z.number(), z.number()]),
  forgiveness: z.tuple([z.number(), z.number()]),
  helpSeeking: z.tuple([z.number(), z.number()]),
});
export type TraitRangeSchema = z.infer<typeof TraitRangeSchema>;

export const PersonaArchetype = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  traitRanges: TraitRangeSchema,
  demographicDefaults: z.object({
    ageGroup: AgeGroup,
    gender: Gender,
  }).optional(),
});
export type PersonaArchetype = z.infer<typeof PersonaArchetype>;

export const PersonaGroup = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  archetypes: z.array(PersonaArchetype),
});
export type PersonaGroup = z.infer<typeof PersonaGroup>;

// ---------- Create / Batch schemas ----------

export const CreatePersonaInput = z.object({
  projectId: z.string(),
  name: z.string().min(1),
  ageGroup: AgeGroup,
  gender: Gender,
  traits: PersonaTraits,
  accessibilityNeeds: z.array(z.string()).optional(),
  // legacy field — still accepted but no longer required
  knobs: PersonaKnobs.optional(),
});
export type CreatePersonaInput = z.infer<typeof CreatePersonaInput>;

export const BatchGenerateInput = z.object({
  projectId: z.string(),
  groupIds: z.array(z.string()).min(1),
  disabledArchetypeIds: z.array(z.string()).optional(),
  count: z.number().int().min(1).max(200),
});
export type BatchGenerateInput = z.infer<typeof BatchGenerateInput>;

export const GeneratedPersona = z.object({
  name: z.string(),
  ageGroup: AgeGroup,
  gender: Gender,
  traits: PersonaTraits,
  accessibilityNeeds: z.array(z.string()),
  archetype: z.string(),
  groupId: z.string(),
});
export type GeneratedPersona = z.infer<typeof GeneratedPersona>;
