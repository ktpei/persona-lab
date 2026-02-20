import type { TraitModifiers as TraitModifiersType, SubgroupTag as SubgroupTagType } from "./types/persona.js";
import type { TraitRange } from "./constants.js";

const TRAIT_KEYS = [
  "patience",
  "exploration",
  "frustrationSensitivity",
  "forgiveness",
  "helpSeeking",
] as const;

type TraitKey = (typeof TRAIT_KEYS)[number];

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Stack subgroup modifiers additively onto a base trait range, clamping to [0, 1].
 */
export function applySubgroupModifiers(
  baseRanges: TraitRange,
  subgroups: SubgroupTagType[],
): TraitRange {
  const result = { ...baseRanges } as Record<TraitKey, [number, number]>;

  for (const key of TRAIT_KEYS) {
    let [lo, hi] = baseRanges[key];
    for (const sg of subgroups) {
      const mod = (sg.modifiers as TraitModifiersType)[key];
      if (mod !== undefined) {
        lo += mod;
        hi += mod;
      }
    }
    result[key] = [clamp(lo, 0, 1), clamp(hi, 0, 1)];
  }

  return result as TraitRange;
}

/**
 * Generate an archetype one-liner from combined trait ranges and subgroup labels.
 */
export function generateArchetype(
  ranges: TraitRange,
  subgroupLabels: string[],
): string {
  const descriptors: string[] = [];

  for (const key of TRAIT_KEYS) {
    const [lo, hi] = ranges[key];
    const mid = (lo + hi) / 2;
    descriptors.push(traitDescriptor(key, mid));
  }

  const traitText = descriptors.filter(Boolean).join(", ");
  const tagText = subgroupLabels.length > 0 ? ` (${subgroupLabels.join(", ")})` : "";

  return traitText + tagText;
}

function traitDescriptor(key: TraitKey, value: number): string {
  const map: Record<TraitKey, [string, string, string]> = {
    patience:               ["Impatient",         "Moderately patient",  "Very patient"],
    exploration:            ["Stays on path",     "Somewhat exploratory","Highly exploratory"],
    frustrationSensitivity: ["Frustration-proof", "Mildly sensitive",   "Easily frustrated"],
    forgiveness:            ["Unforgiving",       "Moderately forgiving","Very forgiving"],
    helpSeeking:            ["Self-reliant",      "Sometimes asks help", "Help-seeking"],
  };

  const [low, mid, high] = map[key];
  if (value < 0.35) return low;
  if (value > 0.65) return high;
  return mid;
}
