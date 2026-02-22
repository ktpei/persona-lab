import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

interface StepReasoning {
  salient?: string;
  confusions?: Array<{ issue: string; evidence: string }>;
  likelyAction?: string;
  intent?: string;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ episodeId: string }> }
) {
  const { episodeId } = await params;

  const step = await prisma.stepTrace.findFirst({
    where: { episodeId },
    orderBy: { stepIndex: "desc" },
    select: {
      stepIndex: true,
      friction: true,
      reasoning: true,
      observation: true,
    },
  });

  if (!step) {
    return new Response(JSON.stringify({ thought: null }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  }

  const r = step.reasoning as StepReasoning | null;
  const obs = step.observation as { url?: string; pageTitle?: string } | null;

  return new Response(
    JSON.stringify({
      thought: {
        stepIndex: step.stepIndex,
        salient: r?.salient ?? null,
        action: r?.intent ?? r?.likelyAction ?? null,
        friction: step.friction,
        pageTitle: obs?.pageTitle ?? null,
      },
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    }
  );
}
