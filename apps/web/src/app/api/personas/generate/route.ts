import { NextRequest, NextResponse } from "next/server";
import {
  BatchGenerateInput,
  PERSONA_GROUPS,
  DEMOGRAPHIC_PRESETS,
} from "@persona-lab/shared";
import type { GeneratedPersonaType, PersonaArchetypeType } from "@persona-lab/shared";
import { generateNames } from "@/lib/llm";

function sampleInRange(min: number, max: number): number {
  return +(min + Math.random() * (max - min)).toFixed(2);
}

const AGE_GROUPS = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"] as const;
const GENDERS = ["male", "female", "non-binary"] as const;

function randomAgeGroup(): typeof AGE_GROUPS[number] {
  return AGE_GROUPS[Math.floor(Math.random() * AGE_GROUPS.length)];
}

function randomGender(): typeof GENDERS[number] {
  return GENDERS[Math.floor(Math.random() * GENDERS.length)];
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const input = BatchGenerateInput.parse(body);

  // Collect all archetypes from selected groups, filter out disabled ones
  const disabledSet = new Set(input.disabledArchetypeIds ?? []);
  const archetypePool: { archetype: PersonaArchetypeType; groupId: string }[] = [];

  for (const groupId of input.groupIds) {
    const group = PERSONA_GROUPS.find((g) => g.id === groupId);
    if (!group) continue;
    for (const arch of group.archetypes) {
      if (!disabledSet.has(arch.id)) {
        archetypePool.push({ archetype: arch, groupId });
      }
    }
  }

  if (archetypePool.length === 0) {
    return NextResponse.json(
      { error: "No archetypes available after filtering" },
      { status: 400 },
    );
  }

  // Round-robin distribute count across archetypes
  const assignments: { archetype: PersonaArchetypeType; groupId: string }[] = [];
  for (let i = 0; i < input.count; i++) {
    assignments.push(archetypePool[i % archetypePool.length]);
  }

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

  const personas: GeneratedPersonaType[] = assignments.map(({ archetype, groupId }, i) => {
    // Determine demographics: 70% archetype default, 30% random
    let ageGroup: string;
    let gender: string;
    if (archetype.demographicDefaults && Math.random() < 0.7) {
      ageGroup = archetype.demographicDefaults.ageGroup;
      gender = archetype.demographicDefaults.gender;
    } else {
      ageGroup = randomAgeGroup();
      gender = randomGender();
    }

    return {
      name: names[i],
      ageGroup: ageGroup as GeneratedPersonaType["ageGroup"],
      gender: gender as GeneratedPersonaType["gender"],
      traits: {
        patience: sampleInRange(...archetype.traitRanges.patience),
        exploration: sampleInRange(...archetype.traitRanges.exploration),
        frustrationSensitivity: sampleInRange(...archetype.traitRanges.frustrationSensitivity),
        forgiveness: sampleInRange(...archetype.traitRanges.forgiveness),
        helpSeeking: sampleInRange(...archetype.traitRanges.helpSeeking),
      },
      accessibilityNeeds: [],
      archetype: archetype.label,
      groupId,
    };
  });

  return NextResponse.json(personas);
}
