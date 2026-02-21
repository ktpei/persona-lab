export const QUEUE_NAMES = {
  PARSE_FRAME: "parse_frame",
  SIMULATE_EPISODE: "simulate_episode",
  SIMULATE_AGENT_EPISODE: "simulate_agent_episode",
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

// ---------- Persona Groups & Archetypes ----------

import type { PersonaGroup as PersonaGroupType } from "./types/persona.js";

export const PERSONA_GROUPS: PersonaGroupType[] = [
  // ===== 1. E-Commerce Shoppers =====
  {
    id: "e-commerce",
    label: "E-Commerce Shoppers",
    description: "Online retail users spanning bargain hunters to impulse buyers",
    archetypes: [
      {
        id: "bargain-hunter",
        label: "Bargain Hunter",
        description: "Patiently compares prices across tabs, hunts for coupons before checkout",
        traitRanges: {
          patience:               [0.65, 0.85],
          exploration:            [0.75, 0.95],
          frustrationSensitivity: [0.20, 0.40],
          forgiveness:            [0.45, 0.65],
          helpSeeking:            [0.20, 0.40],
        },
        demographicDefaults: { ageGroup: "35-44", gender: "female" },
      },
      {
        id: "impulse-buyer",
        label: "Impulse Buyer",
        description: "Adds to cart on instinct, loses interest if checkout takes too long",
        traitRanges: {
          patience:               [0.05, 0.25],
          exploration:            [0.55, 0.75],
          frustrationSensitivity: [0.25, 0.45],
          forgiveness:            [0.65, 0.85],
          helpSeeking:            [0.15, 0.35],
        },
        demographicDefaults: { ageGroup: "18-24", gender: "female" },
      },
      {
        id: "comparison-shopper",
        label: "Comparison Shopper",
        description: "Opens multiple products side-by-side, reads every spec and review",
        traitRanges: {
          patience:               [0.75, 0.95],
          exploration:            [0.80, 1.00],
          frustrationSensitivity: [0.10, 0.30],
          forgiveness:            [0.40, 0.60],
          helpSeeking:            [0.15, 0.35],
        },
        demographicDefaults: { ageGroup: "25-34", gender: "male" },
      },
      {
        id: "return-prone",
        label: "Return-Prone",
        description: "Buys with intent to return, highly sensitive to unmet expectations",
        traitRanges: {
          patience:               [0.25, 0.45],
          exploration:            [0.30, 0.50],
          frustrationSensitivity: [0.75, 0.95],
          forgiveness:            [0.05, 0.25],
          helpSeeking:            [0.70, 0.90],
        },
        demographicDefaults: { ageGroup: "25-34", gender: "female" },
      },
      {
        id: "first-time-buyer",
        label: "First-Time Buyer",
        description: "Unfamiliar with the platform, needs guidance and reassurance to complete purchase",
        traitRanges: {
          patience:               [0.30, 0.50],
          exploration:            [0.45, 0.65],
          frustrationSensitivity: [0.60, 0.80],
          forgiveness:            [0.45, 0.65],
          helpSeeking:            [0.70, 0.90],
        },
        demographicDefaults: { ageGroup: "18-24", gender: "male" },
      },
      {
        id: "loyalty-member",
        label: "Loyalty Member",
        description: "Trusts the brand, sticks to familiar flows, forgiving of minor issues",
        traitRanges: {
          patience:               [0.70, 0.90],
          exploration:            [0.15, 0.35],
          frustrationSensitivity: [0.15, 0.35],
          forgiveness:            [0.75, 0.95],
          helpSeeking:            [0.20, 0.40],
        },
        demographicDefaults: { ageGroup: "45-54", gender: "female" },
      },
      {
        id: "window-shopper",
        label: "Window Shopper",
        description: "Browses extensively without buying, enjoys exploring but rarely commits",
        traitRanges: {
          patience:               [0.60, 0.80],
          exploration:            [0.75, 0.95],
          frustrationSensitivity: [0.05, 0.25],
          forgiveness:            [0.50, 0.70],
          helpSeeking:            [0.10, 0.30],
        },
        demographicDefaults: { ageGroup: "18-24", gender: "non-binary" },
      },
      {
        id: "gift-buyer",
        label: "Gift Buyer",
        description: "Shopping for someone else, anxious about picking the wrong item",
        traitRanges: {
          patience:               [0.15, 0.35],
          exploration:            [0.55, 0.75],
          frustrationSensitivity: [0.65, 0.85],
          forgiveness:            [0.30, 0.50],
          helpSeeking:            [0.45, 0.65],
        },
        demographicDefaults: { ageGroup: "35-44", gender: "male" },
      },
    ],
  },

  // ===== 2. SaaS / Onboarding =====
  {
    id: "saas-onboarding",
    label: "SaaS / Onboarding",
    description: "Users evaluating, adopting, or migrating to software products",
    archetypes: [
      {
        id: "free-trial-evaluator",
        label: "Free Trial Evaluator",
        description: "Testing before buying, quick to leave if value isn't immediately obvious",
        traitRanges: {
          patience:               [0.15, 0.35],
          exploration:            [0.70, 0.90],
          frustrationSensitivity: [0.60, 0.80],
          forgiveness:            [0.10, 0.30],
          helpSeeking:            [0.20, 0.40],
        },
        demographicDefaults: { ageGroup: "25-34", gender: "male" },
      },
      {
        id: "power-user-migrating",
        label: "Power User Migrating",
        description: "Expert switching from a competitor, expects feature parity and gets annoyed by gaps",
        traitRanges: {
          patience:               [0.20, 0.40],
          exploration:            [0.65, 0.85],
          frustrationSensitivity: [0.65, 0.85],
          forgiveness:            [0.05, 0.25],
          helpSeeking:            [0.10, 0.30],
        },
        demographicDefaults: { ageGroup: "25-34", gender: "male" },
      },
      {
        id: "non-technical-dm",
        label: "Non-Technical Decision Maker",
        description: "Evaluating for the team without deep technical knowledge, needs hand-holding",
        traitRanges: {
          patience:               [0.45, 0.65],
          exploration:            [0.10, 0.30],
          frustrationSensitivity: [0.55, 0.75],
          forgiveness:            [0.50, 0.70],
          helpSeeking:            [0.75, 0.95],
        },
        demographicDefaults: { ageGroup: "35-44", gender: "female" },
      },
      {
        id: "developer",
        label: "Developer",
        description: "Self-sufficient, reads docs before asking, explores APIs and integrations freely",
        traitRanges: {
          patience:               [0.60, 0.80],
          exploration:            [0.80, 1.00],
          frustrationSensitivity: [0.10, 0.30],
          forgiveness:            [0.30, 0.50],
          helpSeeking:            [0.05, 0.25],
        },
        demographicDefaults: { ageGroup: "25-34", gender: "male" },
      },
      {
        id: "team-admin",
        label: "Team Admin",
        description: "Manages settings and users for the team, forgiving but needs things to work",
        traitRanges: {
          patience:               [0.45, 0.65],
          exploration:            [0.40, 0.60],
          frustrationSensitivity: [0.30, 0.50],
          forgiveness:            [0.65, 0.85],
          helpSeeking:            [0.65, 0.85],
        },
        demographicDefaults: { ageGroup: "35-44", gender: "female" },
      },
      {
        id: "reluctant-adopter",
        label: "Reluctant Adopter",
        description: "Forced to use the tool by management, resistant to change, easily frustrated",
        traitRanges: {
          patience:               [0.10, 0.30],
          exploration:            [0.05, 0.25],
          frustrationSensitivity: [0.70, 0.90],
          forgiveness:            [0.15, 0.35],
          helpSeeking:            [0.30, 0.50],
        },
        demographicDefaults: { ageGroup: "45-54", gender: "male" },
      },
    ],
  },

  // ===== 3. Finance =====
  {
    id: "finance",
    label: "Finance",
    description: "Banking, investing, and financial management users",
    archetypes: [
      {
        id: "security-conscious",
        label: "Security-Conscious",
        description: "Suspicious of every prompt, avoids unfamiliar features, demands clear security cues",
        traitRanges: {
          patience:               [0.60, 0.80],
          exploration:            [0.05, 0.25],
          frustrationSensitivity: [0.65, 0.85],
          forgiveness:            [0.20, 0.40],
          helpSeeking:            [0.15, 0.35],
        },
        demographicDefaults: { ageGroup: "45-54", gender: "male" },
      },
      {
        id: "first-time-investor",
        label: "First-Time Investor",
        description: "Nervous about financial decisions, needs guidance and reassurance at every step",
        traitRanges: {
          patience:               [0.30, 0.50],
          exploration:            [0.15, 0.35],
          frustrationSensitivity: [0.70, 0.90],
          forgiveness:            [0.45, 0.65],
          helpSeeking:            [0.75, 0.95],
        },
        demographicDefaults: { ageGroup: "25-34", gender: "female" },
      },
      {
        id: "frequent-transactor",
        label: "Frequent Transactor",
        description: "Uses the app daily for transfers and payments, expects instant speed",
        traitRanges: {
          patience:               [0.10, 0.30],
          exploration:            [0.50, 0.70],
          frustrationSensitivity: [0.55, 0.75],
          forgiveness:            [0.30, 0.50],
          helpSeeking:            [0.20, 0.40],
        },
        demographicDefaults: { ageGroup: "35-44", gender: "male" },
      },
      {
        id: "budget-tracker",
        label: "Budget Tracker",
        description: "Methodically reviews spending, explores reports and categories, patient with detail",
        traitRanges: {
          patience:               [0.70, 0.90],
          exploration:            [0.60, 0.80],
          frustrationSensitivity: [0.15, 0.35],
          forgiveness:            [0.55, 0.75],
          helpSeeking:            [0.25, 0.45],
        },
        demographicDefaults: { ageGroup: "25-34", gender: "female" },
      },
      {
        id: "business-account",
        label: "Business Account",
        description: "Managing company finances, low tolerance for errors, needs audit trails",
        traitRanges: {
          patience:               [0.20, 0.40],
          exploration:            [0.35, 0.55],
          frustrationSensitivity: [0.60, 0.80],
          forgiveness:            [0.10, 0.30],
          helpSeeking:            [0.45, 0.65],
        },
        demographicDefaults: { ageGroup: "35-44", gender: "male" },
      },
    ],
  },

  // ===== 4. Travel =====
  {
    id: "travel",
    label: "Travel",
    description: "Booking, planning, and managing travel experiences",
    archetypes: [
      {
        id: "last-minute-booker",
        label: "Last-Minute Booker",
        description: "Booking under time pressure, needs the fastest path to confirmation",
        traitRanges: {
          patience:               [0.05, 0.25],
          exploration:            [0.20, 0.40],
          frustrationSensitivity: [0.75, 0.95],
          forgiveness:            [0.25, 0.45],
          helpSeeking:            [0.30, 0.50],
        },
        demographicDefaults: { ageGroup: "25-34", gender: "male" },
      },
      {
        id: "planner-researcher",
        label: "Planner / Researcher",
        description: "Researches destinations for weeks, compares every option before booking",
        traitRanges: {
          patience:               [0.75, 0.95],
          exploration:            [0.80, 1.00],
          frustrationSensitivity: [0.10, 0.30],
          forgiveness:            [0.50, 0.70],
          helpSeeking:            [0.15, 0.35],
        },
        demographicDefaults: { ageGroup: "35-44", gender: "female" },
      },
      {
        id: "business-traveler",
        label: "Business Traveler",
        description: "Needs efficient booking with expense tracking, no patience for unnecessary steps",
        traitRanges: {
          patience:               [0.15, 0.35],
          exploration:            [0.20, 0.40],
          frustrationSensitivity: [0.65, 0.85],
          forgiveness:            [0.15, 0.35],
          helpSeeking:            [0.35, 0.55],
        },
        demographicDefaults: { ageGroup: "35-44", gender: "male" },
      },
      {
        id: "family-traveler",
        label: "Family Traveler",
        description: "Booking for a group with diverse needs, patient but needs clear info",
        traitRanges: {
          patience:               [0.55, 0.75],
          exploration:            [0.35, 0.55],
          frustrationSensitivity: [0.50, 0.70],
          forgiveness:            [0.60, 0.80],
          helpSeeking:            [0.70, 0.90],
        },
        demographicDefaults: { ageGroup: "35-44", gender: "female" },
      },
      {
        id: "budget-backpacker",
        label: "Budget Backpacker",
        description: "Hunts for cheapest options, comfortable with rough edges, explores everything",
        traitRanges: {
          patience:               [0.65, 0.85],
          exploration:            [0.75, 0.95],
          frustrationSensitivity: [0.10, 0.30],
          forgiveness:            [0.65, 0.85],
          helpSeeking:            [0.10, 0.30],
        },
        demographicDefaults: { ageGroup: "18-24", gender: "male" },
      },
      {
        id: "luxury-seeker",
        label: "Luxury Seeker",
        description: "Expects premium experience, intolerant of clunky UI or unclear pricing",
        traitRanges: {
          patience:               [0.20, 0.40],
          exploration:            [0.45, 0.65],
          frustrationSensitivity: [0.75, 0.95],
          forgiveness:            [0.05, 0.25],
          helpSeeking:            [0.50, 0.70],
        },
        demographicDefaults: { ageGroup: "45-54", gender: "female" },
      },
    ],
  },

  // ===== 5. Healthcare =====
  {
    id: "healthcare",
    label: "Healthcare",
    description: "Patients, caregivers, and health-tracking users",
    archetypes: [
      {
        id: "anxious-patient",
        label: "Anxious Patient",
        description: "Stressed about health outcomes, overwhelmed by medical interfaces, needs clarity",
        traitRanges: {
          patience:               [0.15, 0.35],
          exploration:            [0.10, 0.30],
          frustrationSensitivity: [0.80, 1.00],
          forgiveness:            [0.20, 0.40],
          helpSeeking:            [0.75, 0.95],
        },
        demographicDefaults: { ageGroup: "25-34", gender: "female" },
      },
      {
        id: "caregiver-proxy",
        label: "Caregiver / Proxy",
        description: "Managing health tasks for someone else, patient but needs everything to be clear",
        traitRanges: {
          patience:               [0.55, 0.75],
          exploration:            [0.40, 0.60],
          frustrationSensitivity: [0.45, 0.65],
          forgiveness:            [0.60, 0.80],
          helpSeeking:            [0.70, 0.90],
        },
        demographicDefaults: { ageGroup: "45-54", gender: "female" },
      },
      {
        id: "chronic-condition",
        label: "Chronic Condition",
        description: "Regular user managing ongoing health, knows the system well, sticks to routines",
        traitRanges: {
          patience:               [0.70, 0.90],
          exploration:            [0.15, 0.35],
          frustrationSensitivity: [0.25, 0.45],
          forgiveness:            [0.65, 0.85],
          helpSeeking:            [0.50, 0.70],
        },
        demographicDefaults: { ageGroup: "55-64", gender: "male" },
      },
      {
        id: "first-time-patient",
        label: "First-Time Patient",
        description: "New to the healthcare portal, confused by medical terminology and workflows",
        traitRanges: {
          patience:               [0.25, 0.45],
          exploration:            [0.15, 0.35],
          frustrationSensitivity: [0.65, 0.85],
          forgiveness:            [0.45, 0.65],
          helpSeeking:            [0.75, 0.95],
        },
        demographicDefaults: { ageGroup: "18-24", gender: "female" },
      },
      {
        id: "proactive-tracker",
        label: "Proactive Tracker",
        description: "Actively monitors vitals and trends, self-sufficient power user of health tools",
        traitRanges: {
          patience:               [0.60, 0.80],
          exploration:            [0.70, 0.90],
          frustrationSensitivity: [0.10, 0.30],
          forgiveness:            [0.45, 0.65],
          helpSeeking:            [0.15, 0.35],
        },
        demographicDefaults: { ageGroup: "25-34", gender: "male" },
      },
    ],
  },

  // ===== 6. Support =====
  {
    id: "support",
    label: "Support",
    description: "Users seeking help, filing tickets, or using self-service resources",
    archetypes: [
      {
        id: "frustrated-escalator",
        label: "Frustrated Escalator",
        description: "Already angry before reaching support, demands immediate resolution",
        traitRanges: {
          patience:               [0.00, 0.20],
          exploration:            [0.20, 0.40],
          frustrationSensitivity: [0.80, 1.00],
          forgiveness:            [0.00, 0.20],
          helpSeeking:            [0.70, 0.90],
        },
        demographicDefaults: { ageGroup: "35-44", gender: "male" },
      },
      {
        id: "self-service-preferred",
        label: "Self-Service Preferred",
        description: "Prefers docs and FAQs over human contact, only escalates as a last resort",
        traitRanges: {
          patience:               [0.55, 0.75],
          exploration:            [0.70, 0.90],
          frustrationSensitivity: [0.15, 0.35],
          forgiveness:            [0.45, 0.65],
          helpSeeking:            [0.00, 0.20],
        },
        demographicDefaults: { ageGroup: "25-34", gender: "male" },
      },
      {
        id: "repeat-issue",
        label: "Repeat Issue",
        description: "Returning with the same problem, patience is already worn thin",
        traitRanges: {
          patience:               [0.10, 0.30],
          exploration:            [0.25, 0.45],
          frustrationSensitivity: [0.75, 0.95],
          forgiveness:            [0.05, 0.25],
          helpSeeking:            [0.55, 0.75],
        },
        demographicDefaults: { ageGroup: "45-54", gender: "female" },
      },
      {
        id: "first-time-support",
        label: "First-Time Support",
        description: "New to the support process, unsure how to describe the issue, open to guidance",
        traitRanges: {
          patience:               [0.45, 0.65],
          exploration:            [0.30, 0.50],
          frustrationSensitivity: [0.45, 0.65],
          forgiveness:            [0.60, 0.80],
          helpSeeking:            [0.75, 0.95],
        },
        demographicDefaults: { ageGroup: "18-24", gender: "female" },
      },
    ],
  },

  // ===== 7. General / Cross-Domain =====
  {
    id: "general",
    label: "General",
    description: "Universal user archetypes that apply across any product or domain",
    archetypes: [
      {
        id: "mobile-first",
        label: "Mobile-First",
        description: "Primarily uses phone, expects tap-friendly UI, low patience for desktop patterns",
        traitRanges: {
          patience:               [0.15, 0.35],
          exploration:            [0.30, 0.50],
          frustrationSensitivity: [0.65, 0.85],
          forgiveness:            [0.25, 0.45],
          helpSeeking:            [0.40, 0.60],
        },
        demographicDefaults: { ageGroup: "18-24", gender: "male" },
      },
      {
        id: "accessibility-dependent",
        label: "Accessibility-Dependent",
        description: "Relies on assistive technology, blocked by inaccessible patterns, seeks help readily",
        traitRanges: {
          patience:               [0.55, 0.75],
          exploration:            [0.20, 0.40],
          frustrationSensitivity: [0.60, 0.80],
          forgiveness:            [0.45, 0.65],
          helpSeeking:            [0.75, 0.95],
        },
        demographicDefaults: { ageGroup: "55-64", gender: "female" },
      },
      {
        id: "rushed-user",
        label: "Rushed User",
        description: "Under time pressure, skips instructions, clicks the first thing that looks right",
        traitRanges: {
          patience:               [0.00, 0.20],
          exploration:            [0.10, 0.30],
          frustrationSensitivity: [0.75, 0.95],
          forgiveness:            [0.20, 0.40],
          helpSeeking:            [0.25, 0.45],
        },
        demographicDefaults: { ageGroup: "25-34", gender: "male" },
      },
      {
        id: "distracted-user",
        label: "Distracted User",
        description: "Multitasking, loses context easily, forgiving of mistakes but drifts away",
        traitRanges: {
          patience:               [0.15, 0.35],
          exploration:            [0.15, 0.35],
          frustrationSensitivity: [0.45, 0.65],
          forgiveness:            [0.60, 0.80],
          helpSeeking:            [0.30, 0.50],
        },
        demographicDefaults: { ageGroup: "18-24", gender: "female" },
      },
      {
        id: "privacy-conscious",
        label: "Privacy-Conscious",
        description: "Avoids sharing data, suspicious of permissions, won't explore features that feel invasive",
        traitRanges: {
          patience:               [0.45, 0.65],
          exploration:            [0.05, 0.25],
          frustrationSensitivity: [0.55, 0.75],
          forgiveness:            [0.15, 0.35],
          helpSeeking:            [0.10, 0.30],
        },
        demographicDefaults: { ageGroup: "35-44", gender: "male" },
      },
      {
        id: "non-native-speaker",
        label: "Non-Native Speaker",
        description: "Struggles with jargon and idioms, needs simple language and visual cues",
        traitRanges: {
          patience:               [0.45, 0.65],
          exploration:            [0.15, 0.35],
          frustrationSensitivity: [0.65, 0.85],
          forgiveness:            [0.50, 0.70],
          helpSeeking:            [0.70, 0.90],
        },
        demographicDefaults: { ageGroup: "25-34", gender: "female" },
      },
    ],
  },
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
