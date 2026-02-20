import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CreatePersonaInput } from "@persona-lab/shared";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const input = CreatePersonaInput.parse(body);

  const persona = await prisma.persona.create({
    data: {
      projectId: input.projectId,
      name: input.name,
      ageGroup: input.ageGroup,
      gender: input.gender,
      traits: {
        ...input.traits,
        accessibilityNeeds: input.accessibilityNeeds ?? [],
      },
      ...(input.knobs ? { knobs: input.knobs } : {}),
    },
  });

  return NextResponse.json(persona, { status: 201 });
}
