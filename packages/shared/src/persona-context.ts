export interface PersonaData {
  name: string;
  knobs: unknown;
  traits: unknown;
  ageGroup: string | null;
  gender: string | null;
}

export function describeTraitLevel(value: number): "low" | "mid" | "high" {
  if (value < 0.35) return "low";
  if (value > 0.65) return "high";
  return "mid";
}

export function traitToProse(trait: string, value: number): string {
  const level = describeTraitLevel(value);
  const descriptions: Record<string, Record<"low" | "mid" | "high", string>> = {
    patience: {
      low: "Very impatient — quickly frustrated by slow or confusing interfaces, likely to abandon if things don't work immediately",
      mid: "Moderately patient — willing to try a few times but will give up if stuck too long",
      high: "Very patient — pushes through confusion and keeps trying even when the interface is unclear",
    },
    exploration: {
      low: "Not exploratory — sticks to the most obvious path, avoids clicking on unfamiliar elements",
      mid: "Somewhat exploratory — will occasionally click around but prefers clear navigation",
      high: "Highly exploratory — loves clicking around, discovering features, and trying new things",
    },
    frustrationSensitivity: {
      low: "Low frustration sensitivity — stays calm when confused or blocked, takes obstacles in stride",
      mid: "Moderate frustration sensitivity — gets mildly annoyed at friction but can push through",
      high: "Very sensitive to frustration — gets noticeably upset when confused or blocked",
    },
    forgiveness: {
      low: "Unforgiving of bad UX — blames the interface rather than themselves when things go wrong",
      mid: "Somewhat forgiving — may try once more before blaming the interface",
      high: "Very forgiving — assumes they made a mistake, willing to try again and give the interface benefit of the doubt",
    },
    helpSeeking: {
      low: "Avoids seeking help — prefers to struggle alone rather than looking for support options",
      mid: "Sometimes seeks help — will look for support if stuck for a while",
      high: "Actively seeks help — will look for support, FAQ, or chat options when stuck",
    },
  };

  return descriptions[trait]?.[level] ?? `${trait}: ${value.toFixed(2)}`;
}

export function buildPersonaContext(persona: PersonaData): string {
  const traits = persona.traits as {
    patience?: number;
    exploration?: number;
    frustrationSensitivity?: number;
    forgiveness?: number;
    helpSeeking?: number;
    accessibilityNeeds?: string[];
  } | null;

  // New path: OCEAN-based traits with prose conversion
  if (traits && typeof traits.patience === "number") {
    const lines: string[] = [];
    lines.push(`You are "${persona.name}".`);
    lines.push("");

    const demographics: string[] = [];
    if (persona.gender) demographics.push(persona.gender);
    if (persona.ageGroup) demographics.push(`in the ${persona.ageGroup} age range`);
    if (demographics.length > 0) {
      lines.push(`You are a ${demographics.join(" ")} user.`);
      lines.push("");
    }

    lines.push("Your behavioral profile:");
    lines.push(`- ${traitToProse("patience", traits.patience)}`);
    if (typeof traits.exploration === "number")
      lines.push(`- ${traitToProse("exploration", traits.exploration)}`);
    if (typeof traits.frustrationSensitivity === "number")
      lines.push(`- ${traitToProse("frustrationSensitivity", traits.frustrationSensitivity)}`);
    if (typeof traits.forgiveness === "number")
      lines.push(`- ${traitToProse("forgiveness", traits.forgiveness)}`);
    if (typeof traits.helpSeeking === "number")
      lines.push(`- ${traitToProse("helpSeeking", traits.helpSeeking)}`);

    if (traits.accessibilityNeeds && traits.accessibilityNeeds.length > 0) {
      lines.push("");
      lines.push(`Your accessibility needs: ${traits.accessibilityNeeds.join(", ")}`);
    }

    return lines.join("\n");
  }

  // Legacy fallback: old knobs format
  const knobs = persona.knobs as {
    patience: number;
    techSavviness: number;
    goalOrientation: number;
    explorationTendency: number;
    accessibilityNeeds: string[];
    customTraits: Record<string, number>;
  } | null;

  if (knobs) {
    const traitLines = [
      `Patience: ${knobs.patience} (${knobs.patience < 0.3 ? "very impatient" : knobs.patience > 0.7 ? "very patient" : "moderate"})`,
      `Tech savviness: ${knobs.techSavviness} (${knobs.techSavviness < 0.3 ? "novice user" : knobs.techSavviness > 0.7 ? "power user" : "average"})`,
      `Goal orientation: ${knobs.goalOrientation} (${knobs.goalOrientation > 0.7 ? "very focused on completing task" : "may get distracted"})`,
      `Exploration tendency: ${knobs.explorationTendency} (${knobs.explorationTendency > 0.7 ? "likes to explore and click around" : "sticks to the main path"})`,
    ];

    if (knobs.accessibilityNeeds?.length > 0) {
      traitLines.push(`Accessibility needs: ${knobs.accessibilityNeeds.join(", ")}`);
    }

    for (const [trait, value] of Object.entries(knobs.customTraits || {})) {
      traitLines.push(`${trait}: ${value}`);
    }

    return `You are "${persona.name}" with these behavioral traits:\n${traitLines.join("\n")}`;
  }

  return `You are "${persona.name}".`;
}
