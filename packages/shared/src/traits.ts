import type { TraitRange } from "./constants.js";

const TRAIT_KEYS = [
  "patience",
  "exploration",
  "frustrationSensitivity",
  "forgiveness",
  "helpSeeking",
] as const;

type TraitKey = (typeof TRAIT_KEYS)[number];

/**
 * Generate an archetype one-liner from trait ranges and the archetype label.
 */
export function generateArchetype(
  ranges: TraitRange,
  archetypeLabel: string,
): string {
  const descriptors: string[] = [];

  for (const key of TRAIT_KEYS) {
    const [lo, hi] = ranges[key];
    const mid = (lo + hi) / 2;
    descriptors.push(traitDescriptor(key, mid));
  }

  const traitText = descriptors.filter(Boolean).join(", ");
  return archetypeLabel ? `${archetypeLabel}: ${traitText}` : traitText;
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
