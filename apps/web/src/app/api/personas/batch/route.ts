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
      archetype: z.string(),
      groupId: z.string(),
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
            archetype: p.archetype,
            groupId: p.groupId,
          },
        },
      })
    )
  );

  return NextResponse.json(created, { status: 201 });
}
