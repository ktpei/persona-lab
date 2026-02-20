import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { PersonaTraits, AgeGroup, Gender } from "@persona-lab/shared";

const BatchSaveInput = z.object({
  projectId: z.string(),
  personas: z.array(
    z.object({
      name: z.string().min(1),
      ageGroup: AgeGroup,
      gender: Gender,
      traits: PersonaTraits,
      accessibilityNeeds: z.array(z.string()),
      subgroupTags: z.array(z.string()).optional(),
      archetype: z.string().optional(),
    })
  ),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const input = BatchSaveInput.parse(body);

  const created = await prisma.$transaction(
    input.personas.map((p) =>
      prisma.persona.create({
        data: {
          projectId: input.projectId,
          name: p.name,
          ageGroup: p.ageGroup,
          gender: p.gender,
          traits: {
            ...p.traits,
            accessibilityNeeds: p.accessibilityNeeds,
            ...(p.subgroupTags && { subgroupTags: p.subgroupTags }),
            ...(p.archetype && { archetype: p.archetype }),
          },
        },
      })
    )
  );

  return NextResponse.json(created, { status: 201 });
}
