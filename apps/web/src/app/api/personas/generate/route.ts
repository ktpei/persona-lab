import { NextRequest, NextResponse } from "next/server";
import {
  BatchGenerateInput,
  DEMOGRAPHIC_PRESETS,
  SUBGROUP_TAGS,
  applySubgroupModifiers,
  generateArchetype,
} from "@persona-lab/shared";
import type { GeneratedPersonaType, SubgroupTagType } from "@persona-lab/shared";
import { generateNames } from "@/lib/llm";

function sampleInRange(min: number, max: number): number {
  return +(min + Math.random() * (max - min)).toFixed(2);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const input = BatchGenerateInput.parse(body);

  const preset = DEMOGRAPHIC_PRESETS.find((p) => p.id === input.presetId);
  if (!preset) {
    return NextResponse.json({ error: "Unknown preset" }, { status: 400 });
  }

  // Resolve subgroup tags
  const resolvedTags: SubgroupTagType[] = [];
  if (input.subgroupTagIds?.length) {
    for (const tagId of input.subgroupTagIds) {
      const found = SUBGROUP_TAGS.find((t) => t.id === tagId);
      if (found) resolvedTags.push(found);
    }
  }
  if (input.customSubgroups?.length) {
    resolvedTags.push(...input.customSubgroups);
  }

  // Apply subgroup modifiers to trait ranges
  const modifiedRanges = resolvedTags.length > 0
    ? applySubgroupModifiers(preset.traitRanges, resolvedTags)
    : preset.traitRanges;

  // Generate archetype text
  const subgroupLabels = resolvedTags.map((t) => t.label);
  const archetype = generateArchetype(modifiedRanges, subgroupLabels);

  // Generate names via LLM
  let names: string[];
  try {
    names = await generateNames(input.count);
  } catch {
    names = Array.from({ length: input.count }, (_, i) => `Persona ${i + 1}`);
  }
  while (names.length < input.count) {
    names.push(`Persona ${names.length + 1}`);
  }

  const personas: GeneratedPersonaType[] = names.map((name) => ({
    name,
    ageGroup: preset.ageGroup as GeneratedPersonaType["ageGroup"],
    gender: preset.gender as GeneratedPersonaType["gender"],
    traits: {
      patience: sampleInRange(...modifiedRanges.patience),
      exploration: sampleInRange(...modifiedRanges.exploration),
      frustrationSensitivity: sampleInRange(...modifiedRanges.frustrationSensitivity),
      forgiveness: sampleInRange(...modifiedRanges.forgiveness),
      helpSeeking: sampleInRange(...modifiedRanges.helpSeeking),
    },
    accessibilityNeeds: [],
    subgroupTags: subgroupLabels.length > 0 ? subgroupLabels : undefined,
    archetype: archetype || undefined,
  }));

  return NextResponse.json(personas);
}
