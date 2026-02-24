import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { simulateEpisodeQueue, simulateAgentEpisodeQueue } from "@/lib/queue";
import { RunConfig, QUEUE_NAMES } from "@persona-lab/shared";
import { z } from "zod";

const CreateRunInput = z.object({
  flowId: z.string(),
  personaIds: z.array(z.string()).min(1),
  userId: z.string(),
  config: RunConfig.optional().default({}),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const input = CreateRunInput.parse(body);
  const config = RunConfig.parse(input.config);

  // Look up flow to determine mode
  const flow = await prisma.flow.findUnique({
    where: { id: input.flowId },
    select: { mode: true, url: true, goal: true },
  });
  if (!flow) {
    return NextResponse.json({ error: "Flow not found" }, { status: 404 });
  }

  const isAgent = flow.mode === "AGENT";

  // Create run with persona associations and episodes
  const run = await prisma.run.create({
    data: {
      flowId: input.flowId,
      userId: input.userId,
      config,
      mode: flow.mode,
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

  // Enqueue appropriate jobs based on flow mode
  for (const episode of run.episodes) {
    if (isAgent) {
      await simulateAgentEpisodeQueue.add(QUEUE_NAMES.SIMULATE_AGENT_EPISODE, {
        episodeId: episode.id,
        runId: run.id,
        model: config.model,
        maxSteps: config.maxSteps,
        url: flow.url!,
        goal: flow.goal!,
      });
    } else {
      await simulateEpisodeQueue.add(QUEUE_NAMES.SIMULATE_EPISODE, {
        episodeId: episode.id,
        runId: run.id,
        model: config.model,
        maxSteps: config.maxSteps,
        seed: config.seed,
      });
    }
  }

  return NextResponse.json(run, { status: 201 });
}
