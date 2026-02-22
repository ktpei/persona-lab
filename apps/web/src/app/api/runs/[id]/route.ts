import { NextRequest, NextResponse } from "next/server";
import { Queue } from "bullmq";
import { QUEUE_NAMES } from "@persona-lab/shared";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const run = await prisma.run.findUnique({
    where: { id },
    include: {
      episodes: {
        include: {
          persona: true,
          _count: { select: { steps: true } },
        },
      },
      _count: { select: { findings: true } },
    },
  });

  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  return NextResponse.json(run);
}

const TERMINAL_STATUSES = ["COMPLETED", "FAILED", "CANCELLED"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  if (body.action !== "cancel") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const run = await prisma.run.findUnique({ where: { id } });
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
  if (TERMINAL_STATUSES.includes(run.status)) {
    return NextResponse.json({ error: "Run already in terminal state" }, { status: 400 });
  }

  // Set run status to CANCELLED
  await prisma.run.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  // Bulk-cancel all pending/running episodes
  await prisma.episode.updateMany({
    where: { runId: id, status: { in: ["PENDING", "RUNNING"] } },
    data: { status: "CANCELLED" },
  });

  // Remove pending BullMQ jobs so workers don't pick them up and start containers
  try {
    const redisUrl = new URL(process.env.REDIS_URL || "redis://localhost:6379");
    const connection = {
      host: redisUrl.hostname,
      port: Number(redisUrl.port) || 6379,
      maxRetriesPerRequest: null as null,
      lazyConnect: true,
    };

    // Drain waiting jobs from both episode queues
    for (const queueName of [QUEUE_NAMES.SIMULATE_EPISODE, QUEUE_NAMES.SIMULATE_AGENT_EPISODE]) {
      const queue = new Queue(queueName, { connection });
      const waiting = await queue.getWaiting();
      let removed = 0;
      for (const job of waiting) {
        if (job.data?.runId === id) {
          await job.remove().catch(() => {});
          removed++;
        }
      }
      if (removed > 0) {
        console.log(`[cancel] Removed ${removed} pending ${queueName} jobs for run ${id}`);
      }
      await queue.close();
    }
  } catch (err) {
    // Non-fatal — DB cancellation already prevents work, this just saves resources
    console.warn("[cancel] Failed to drain BullMQ jobs:", err instanceof Error ? err.message : err);
  }

  return NextResponse.json({ success: true });
}
