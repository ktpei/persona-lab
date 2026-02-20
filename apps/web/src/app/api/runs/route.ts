import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { simulateEpisodeQueue } from "@/lib/queue";
import { RunConfig, QUEUE_NAMES } from "@persona-lab/shared";
import { z } from "zod";

const CreateRunInput = z.object({
  flowId: z.string(),
  personaIds: z.array(z.string()).min(1),
  config: RunConfig.optional().default({}),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const input = CreateRunInput.parse(body);
  const config = RunConfig.parse(input.config);

  // Create run with persona associations and episodes
  const run = await prisma.run.create({
    data: {
      flowId: input.flowId,
      config,
      status: "SIMULATING",
      personas: {
        create: input.personaIds.map((personaId) => ({ personaId })),
      },
      episodes: {
        create: input.personaIds.map((personaId) => ({
          personaId,
          seed: config.seed,
        })),
      },
    },
    include: {
      personas: true,
      episodes: true,
    },
  });

  // Enqueue simulate jobs directly — no parse step needed
  for (const episode of run.episodes) {
    await simulateEpisodeQueue.add(QUEUE_NAMES.SIMULATE_EPISODE, {
      episodeId: episode.id,
      runId: run.id,
      model: config.model,
      maxSteps: config.maxSteps,
      seed: config.seed,
    });
  }

  return NextResponse.json(run, { status: 201 });
}
