import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/voice/session-store";
import { buildPersonaContext } from "@persona-lab/shared";
import type { PersonaData } from "@persona-lab/shared";
import { randomUUID } from "node:crypto";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { personaId: string; flowId: string };
    const { personaId, flowId } = body;
    if (!personaId || !flowId) {
      return NextResponse.json(
        { error: "personaId and flowId required" },
        { status: 400 }
      );
    }

    const [persona, flow] = await Promise.all([
      prisma.persona.findUnique({
        where: { id: personaId },
      }),
      prisma.flow.findUnique({
        where: { id: flowId },
        include: { frames: { orderBy: { stepIndex: "asc" } } },
      }),
    ]);

    if (!persona || !flow) {
      return NextResponse.json(
        { error: "Persona or flow not found" },
        { status: 404 }
      );
    }

    const personaData: PersonaData = {
      name: persona.name,
      knobs: persona.knobs,
      traits: persona.traits,
      ageGroup: persona.ageGroup,
      gender: persona.gender,
    };
    const personaContext = buildPersonaContext(personaData);
    const traits = (persona.traits ?? {}) as Record<string, number>;
    const flowContext = {
      id: flow.id,
      name: flow.name,
      frameCount: flow.frames.length,
      stepSummaries: flow.frames.map(
        (f) => (f.summary ?? `Step ${f.stepIndex + 1}`).slice(0, 200)
      ),
    };

    const sessionId = randomUUID();
    createSession(
      sessionId,
      persona.id,
      persona.name,
      traits,
      flowContext
    );

    // Relative URL so the client always connects to its current origin (avoids wrong host in proxy/serverless)
    return NextResponse.json({
      sessionId,
      streamUrl: `/api/voice/session/stream?sessionId=${sessionId}`,
      personaName: persona.name,
      flowName: flow.name,
    });
  } catch (err) {
    console.error("[voice/session/start]", err);
    return NextResponse.json(
      { error: "Failed to start voice session" },
      { status: 500 }
    );
  }
}
