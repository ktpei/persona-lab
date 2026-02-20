export const QUEUE_NAMES = {
  PARSE_FRAME: "parse_frame",
  SIMULATE_EPISODE: "simulate_episode",
  AGGREGATE_REPORT: "aggregate_report",
} as const;

export const DEFAULT_MODEL = "google/gemini-2.5-flash";

export const MAX_STEPS_DEFAULT = 30;

// ---------- Model catalog ----------

export const AVAILABLE_MODELS = [
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "Google", inputPrice: 0.30, outputPrice: 2.50 },
  { id: "moonshotai/kimi-k2", name: "Kimi K2", provider: "Moonshot", inputPrice: 0.50, outputPrice: 2.40 },
  { id: "anthropic/claude-haiku-4-5", name: "Claude Haiku 4.5", provider: "Anthropic", inputPrice: 1.00, outputPrice: 5.00 },
  { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "Google", inputPrice: 1.25, outputPrice: 10.00 },
  { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4", provider: "Anthropic", inputPrice: 3.00, outputPrice: 15.00 },
] as const;

export type AvailableModel = (typeof AVAILABLE_MODELS)[number];

// ---------- Subgroup categories & tags ----------

import type { SubgroupTag as SubgroupTagType, SubgroupCategory as SubgroupCategoryType } from "./types/persona.js";

export interface SubgroupCategoryInfo {
  id: SubgroupCategoryType;
  label: string;
}

export const SUBGROUP_CATEGORIES: SubgroupCategoryInfo[] = [
  { id: "cross-domain", label: "Cross-Domain" },
  { id: "e-commerce", label: "E-Commerce" },
  { id: "saas-onboarding", label: "SaaS / Onboarding" },
  { id: "finance", label: "Finance" },
  { id: "travel", label: "Travel" },
  { id: "healthcare", label: "Healthcare" },
  { id: "support", label: "Support" },
];

export const SUBGROUP_TAGS: SubgroupTagType[] = [
  // --- Cross-domain ---
  { id: "mobile-first", label: "Mobile-first", category: "cross-domain", modifiers: { patience: -0.1, exploration: -0.05, frustrationSensitivity: 0.1 } },
  { id: "accessibility-dependent", label: "Accessibility-dependent", category: "cross-domain", modifiers: { patience: 0.15, helpSeeking: 0.2, frustrationSensitivity: 0.15 } },
  { id: "in-a-rush", label: "In a rush", category: "cross-domain", modifiers: { patience: -0.25, exploration: -0.15, frustrationSensitivity: 0.2 } },
  { id: "distracted", label: "Distracted", category: "cross-domain", modifiers: { patience: -0.15, exploration: -0.1, forgiveness: 0.1 } },
  { id: "privacy-conscious", label: "Privacy-conscious", category: "cross-domain", modifiers: { exploration: -0.15, frustrationSensitivity: 0.1, forgiveness: -0.1 } },
  { id: "non-native-speaker", label: "Non-native speaker", category: "cross-domain", modifiers: { patience: 0.1, helpSeeking: 0.15, frustrationSensitivity: 0.1 } },
  // --- E-commerce ---
  { id: "gift-buyer", label: "Gift buyer", category: "e-commerce", modifiers: { patience: -0.1, exploration: 0.1, frustrationSensitivity: 0.1 } },
  { id: "bargain-hunter", label: "Bargain hunter", category: "e-commerce", modifiers: { patience: 0.15, exploration: 0.2, frustrationSensitivity: -0.05 } },
  { id: "impulse-buyer", label: "Impulse buyer", category: "e-commerce", modifiers: { patience: -0.2, exploration: 0.1, forgiveness: 0.1 } },
  { id: "comparison-shopper", label: "Comparison shopper", category: "e-commerce", modifiers: { patience: 0.2, exploration: 0.25, frustrationSensitivity: -0.1 } },
  { id: "return-prone", label: "Return-prone", category: "e-commerce", modifiers: { frustrationSensitivity: 0.15, forgiveness: -0.15, helpSeeking: 0.1 } },
  { id: "loyalty-member", label: "Loyalty member", category: "e-commerce", modifiers: { patience: 0.1, forgiveness: 0.15, exploration: -0.05 } },
  { id: "first-time-buyer", label: "First-time buyer", category: "e-commerce", modifiers: { patience: -0.05, exploration: 0.1, helpSeeking: 0.15, frustrationSensitivity: 0.1 } },
  { id: "window-shopper", label: "Window shopper", category: "e-commerce", modifiers: { patience: 0.1, exploration: 0.2, frustrationSensitivity: -0.15 } },
  // --- SaaS / Onboarding ---
  { id: "free-trial-evaluator", label: "Free trial evaluator", category: "saas-onboarding", modifiers: { patience: -0.15, exploration: 0.15, frustrationSensitivity: 0.1, forgiveness: -0.1 } },
  { id: "power-user-migrating", label: "Power user migrating", category: "saas-onboarding", modifiers: { patience: -0.1, exploration: 0.1, frustrationSensitivity: 0.15, forgiveness: -0.15 } },
  { id: "non-technical-dm", label: "Non-technical DM", category: "saas-onboarding", modifiers: { patience: 0.1, exploration: -0.15, helpSeeking: 0.2, frustrationSensitivity: 0.1 } },
  { id: "developer", label: "Developer", category: "saas-onboarding", modifiers: { patience: 0.1, exploration: 0.2, frustrationSensitivity: -0.1, helpSeeking: -0.15 } },
  { id: "team-admin", label: "Team admin", category: "saas-onboarding", modifiers: { patience: 0.05, exploration: 0.1, frustrationSensitivity: 0.05, helpSeeking: 0.1 } },
  { id: "reluctant-adopter", label: "Reluctant adopter", category: "saas-onboarding", modifiers: { patience: -0.1, exploration: -0.2, frustrationSensitivity: 0.15, forgiveness: -0.1 } },
  // --- Finance ---
  { id: "security-conscious", label: "Security-conscious", category: "finance", modifiers: { patience: 0.1, exploration: -0.15, frustrationSensitivity: 0.15, forgiveness: -0.1 } },
  { id: "first-time-investor", label: "First-time investor", category: "finance", modifiers: { patience: 0.05, exploration: -0.1, helpSeeking: 0.2, frustrationSensitivity: 0.15 } },
  { id: "frequent-transactor", label: "Frequent transactor", category: "finance", modifiers: { patience: -0.15, exploration: 0.05, frustrationSensitivity: 0.1 } },
  { id: "budget-conscious", label: "Budget-conscious", category: "finance", modifiers: { patience: 0.15, exploration: 0.1, frustrationSensitivity: -0.05 } },
  { id: "business-account", label: "Business account", category: "finance", modifiers: { patience: -0.1, frustrationSensitivity: 0.1, forgiveness: -0.1, helpSeeking: 0.1 } },
  // --- Travel ---
  { id: "last-minute-booker", label: "Last-minute booker", category: "travel", modifiers: { patience: -0.25, exploration: -0.1, frustrationSensitivity: 0.2 } },
  { id: "planner-researcher", label: "Planner / researcher", category: "travel", modifiers: { patience: 0.2, exploration: 0.25, frustrationSensitivity: -0.1 } },
  { id: "business-traveler", label: "Business traveler", category: "travel", modifiers: { patience: -0.15, exploration: -0.1, frustrationSensitivity: 0.15, forgiveness: -0.1 } },
  { id: "family-traveler", label: "Family traveler", category: "travel", modifiers: { patience: 0.1, exploration: 0.05, helpSeeking: 0.15, frustrationSensitivity: 0.1 } },
  { id: "budget-backpacker", label: "Budget backpacker", category: "travel", modifiers: { patience: 0.15, exploration: 0.2, frustrationSensitivity: -0.15, forgiveness: 0.1 } },
  { id: "luxury-seeker", label: "Luxury seeker", category: "travel", modifiers: { patience: -0.1, frustrationSensitivity: 0.2, forgiveness: -0.15 } },
  // --- Healthcare ---
  { id: "anxious-patient", label: "Anxious patient", category: "healthcare", modifiers: { patience: -0.1, frustrationSensitivity: 0.25, helpSeeking: 0.2, forgiveness: -0.1 } },
  { id: "caregiver-proxy", label: "Caregiver / proxy", category: "healthcare", modifiers: { patience: 0.1, exploration: 0.05, helpSeeking: 0.15, frustrationSensitivity: 0.1 } },
  { id: "chronic-condition", label: "Chronic condition", category: "healthcare", modifiers: { patience: 0.15, exploration: -0.1, forgiveness: 0.1, helpSeeking: 0.1 } },
  { id: "first-time-patient", label: "First-time patient", category: "healthcare", modifiers: { patience: -0.05, exploration: -0.1, helpSeeking: 0.2, frustrationSensitivity: 0.15 } },
  { id: "proactive-tracker", label: "Proactive tracker", category: "healthcare", modifiers: { patience: 0.1, exploration: 0.15, frustrationSensitivity: -0.1, helpSeeking: -0.05 } },
  // --- Support ---
  { id: "frustrated-escalation", label: "Frustrated / escalation-prone", category: "support", modifiers: { patience: -0.2, frustrationSensitivity: 0.25, forgiveness: -0.2, helpSeeking: 0.15 } },
  { id: "self-service-preferred", label: "Self-service preferred", category: "support", modifiers: { patience: 0.1, exploration: 0.15, helpSeeking: -0.25, frustrationSensitivity: -0.05 } },
  { id: "repeat-issue", label: "Repeat issue", category: "support", modifiers: { patience: -0.15, frustrationSensitivity: 0.2, forgiveness: -0.2 } },
  { id: "first-time-support", label: "First-time support", category: "support", modifiers: { patience: 0.05, helpSeeking: 0.2, frustrationSensitivity: 0.1, forgiveness: 0.1 } },
];

// ---------- Demographic presets ----------

export interface TraitRange {
  patience: [number, number];
  exploration: [number, number];
  frustrationSensitivity: [number, number];
  forgiveness: [number, number];
  helpSeeking: [number, number];
}

export interface DemographicPreset {
  id: string;
  label: string;
  ageGroup: string;
  gender: string;
  traitRanges: TraitRange;
}

export const DEMOGRAPHIC_PRESETS: DemographicPreset[] = [
  {
    id: "gen-z-male",
    label: "Gen Z Males (18-24)",
    ageGroup: "18-24",
    gender: "male",
    traitRanges: {
      patience:               [0.25, 0.50],
      exploration:            [0.55, 0.80],
      frustrationSensitivity: [0.45, 0.70],
      forgiveness:            [0.30, 0.55],
      helpSeeking:            [0.50, 0.75],
    },
  },
  {
    id: "gen-z-female",
    label: "Gen Z Females (18-24)",
    ageGroup: "18-24",
    gender: "female",
    traitRanges: {
      patience:               [0.30, 0.55],
      exploration:            [0.55, 0.80],
      frustrationSensitivity: [0.50, 0.75],
      forgiveness:            [0.40, 0.65],
      helpSeeking:            [0.55, 0.80],
    },
  },
  {
    id: "millennial-male",
    label: "Millennial Males (25-34)",
    ageGroup: "25-34",
    gender: "male",
    traitRanges: {
      patience:               [0.35, 0.60],
      exploration:            [0.45, 0.70],
      frustrationSensitivity: [0.35, 0.60],
      forgiveness:            [0.35, 0.60],
      helpSeeking:            [0.40, 0.65],
    },
  },
  {
    id: "millennial-female",
    label: "Millennial Females (25-34)",
    ageGroup: "25-34",
    gender: "female",
    traitRanges: {
      patience:               [0.40, 0.65],
      exploration:            [0.45, 0.70],
      frustrationSensitivity: [0.40, 0.65],
      forgiveness:            [0.45, 0.70],
      helpSeeking:            [0.50, 0.75],
    },
  },
  {
    id: "gen-x-male",
    label: "Gen X Males (35-44)",
    ageGroup: "35-44",
    gender: "male",
    traitRanges: {
      patience:               [0.45, 0.70],
      exploration:            [0.40, 0.60],
      frustrationSensitivity: [0.30, 0.55],
      forgiveness:            [0.40, 0.65],
      helpSeeking:            [0.35, 0.60],
    },
  },
  {
    id: "gen-x-female",
    label: "Gen X Females (35-44)",
    ageGroup: "35-44",
    gender: "female",
    traitRanges: {
      patience:               [0.50, 0.75],
      exploration:            [0.40, 0.60],
      frustrationSensitivity: [0.35, 0.60],
      forgiveness:            [0.50, 0.70],
      helpSeeking:            [0.45, 0.65],
    },
  },
  {
    id: "middle-aged-male",
    label: "Middle-Aged Males (45-54)",
    ageGroup: "45-54",
    gender: "male",
    traitRanges: {
      patience:               [0.55, 0.80],
      exploration:            [0.35, 0.55],
      frustrationSensitivity: [0.25, 0.50],
      forgiveness:            [0.50, 0.70],
      helpSeeking:            [0.35, 0.55],
    },
  },
  {
    id: "middle-aged-female",
    label: "Middle-Aged Females (45-54)",
    ageGroup: "45-54",
    gender: "female",
    traitRanges: {
      patience:               [0.55, 0.80],
      exploration:            [0.35, 0.55],
      frustrationSensitivity: [0.30, 0.55],
      forgiveness:            [0.55, 0.75],
      helpSeeking:            [0.40, 0.60],
    },
  },
  {
    id: "senior-male",
    label: "Senior Males (65+)",
    ageGroup: "65+",
    gender: "male",
    traitRanges: {
      patience:               [0.60, 0.85],
      exploration:            [0.20, 0.45],
      frustrationSensitivity: [0.20, 0.45],
      forgiveness:            [0.55, 0.80],
      helpSeeking:            [0.30, 0.50],
    },
  },
  {
    id: "senior-female",
    label: "Senior Females (65+)",
    ageGroup: "65+",
    gender: "female",
    traitRanges: {
      patience:               [0.65, 0.85],
      exploration:            [0.20, 0.45],
      frustrationSensitivity: [0.25, 0.50],
      forgiveness:            [0.60, 0.85],
      helpSeeking:            [0.35, 0.55],
    },
  },
];
