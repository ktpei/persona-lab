import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CreatePersonaInput } from "@persona-lab/shared";
import { z } from "zod";

const CreatePersonaInputWithUser = CreatePersonaInput.extend({
  userId: z.string(),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const input = CreatePersonaInputWithUser.parse(body);

  const persona = await prisma.persona.create({
    data: {
      projectId: input.projectId,
      userId: input.userId,
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
