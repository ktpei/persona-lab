import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

interface BrowserAction {
  type: string;
  elementIndex?: number;
  text?: string;
  direction?: string;
  success?: boolean;
  reason?: string;
  x?: number;
  y?: number;
}

interface StepReasoning {
  salient?: string;
  confusions?: Array<{ issue: string; evidence: string }>;
  likelyAction?: string;
  intent?: string;
  browserAction?: BrowserAction;
  memoryUpdate?: string;
  error?: string;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ episodeId: string }> }
) {
  const { episodeId } = await params;

  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    include: {
      run: {
        include: {
          flow: { select: { mode: true } },
        },
      },
      steps: {
        orderBy: { stepIndex: "asc" },
        include: {
          frame: { select: { stepIndex: true } },
        },
      },
    },
  });

  if (!episode) {
    return new Response(JSON.stringify({ error: "Episode not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const isAgentMode = episode.run.flow.mode === "AGENT";

  const steps = episode.steps.map((step) => {
    const r = step.reasoning as StepReasoning | null;
    const obs = step.observation as { url?: string; pageTitle?: string; elementCount?: number } | null;

    let screenLabel: string;
    if (isAgentMode && obs?.url) {
      try {
        const pathname = new URL(obs.url).pathname;
        screenLabel = obs.pageTitle || pathname;
      } catch {
        screenLabel = `Step ${step.stepIndex + 1}`;
      }
    } else {
      const frameIdx = step.frame?.stepIndex ?? step.stepIndex;
      screenLabel = `Frame ${frameIdx + 1}`;
    }

    return {
      stepId: step.id,
      stepIndex: step.stepIndex,
      screenLabel,
      friction: step.friction,
      confidence: step.confidence,
      dropoffRisk: step.dropoffRisk,
      salient: r?.salient,
      action: r?.intent ?? r?.likelyAction,
      confusions: r?.confusions ?? [],
      // Debug fields
      browserAction: r?.browserAction,
      memoryUpdate: r?.memoryUpdate,
      url: obs?.url,
      elementCount: obs?.elementCount,
      error: r?.error,
    };
  });

  return new Response(JSON.stringify({ steps }), {
    headers: { "Content-Type": "application/json" },
  });
}
