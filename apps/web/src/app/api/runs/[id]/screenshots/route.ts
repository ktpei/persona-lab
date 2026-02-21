import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Returns one representative screenshot per screen for a run.
 * Used by the friction heatmap to show page thumbnails.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const run = await prisma.run.findUnique({
    where: { id },
    select: { mode: true },
  });

  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  // Fetch all steps for this run with screenshot info
  const steps = await prisma.stepTrace.findMany({
    where: { episode: { runId: id } },
    select: {
      id: true,
      screenshotPath: true,
      frameId: true,
      observation: true,
      frame: { select: { stepIndex: true } },
    },
    orderBy: { stepIndex: "asc" },
  });

  // Group by screen and pick the first step as representative
  const screenMap = new Map<number, { stepId: string; screenLabel?: string }>();

  if (run.mode === "AGENT") {
    // Agent mode: group by URL pathname
    const urlToIndex = new Map<string, number>();
    let nextIndex = 0;

    for (const step of steps) {
      if (!step.screenshotPath) continue;
      const obs = step.observation as { url?: string } | null;
      const url = obs?.url ?? "unknown";
      let pathname: string;
      try {
        pathname = new URL(url).pathname;
      } catch {
        pathname = url;
      }

      if (!urlToIndex.has(pathname)) {
        urlToIndex.set(pathname, nextIndex++);
      }
      const screenIndex = urlToIndex.get(pathname)!;

      if (!screenMap.has(screenIndex)) {
        screenMap.set(screenIndex, { stepId: step.id, screenLabel: pathname });
      }
    }
  } else {
    // Screenshot mode: group by frame stepIndex
    for (const step of steps) {
      const screenIndex = step.frame?.stepIndex ?? 0;
      if (!screenMap.has(screenIndex)) {
        screenMap.set(screenIndex, { stepId: step.id });
      }
    }
  }

  const screens = Array.from(screenMap.entries())
    .map(([screenIndex, data]) => ({ screenIndex, ...data }))
    .sort((a, b) => a.screenIndex - b.screenIndex);

  return NextResponse.json({ screens });
}
