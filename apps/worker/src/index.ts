import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Load .env — use DOTENV_PATH if set (e.g. /app/.env in Docker), else repo root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({
  path: process.env.DOTENV_PATH || path.resolve(__dirname, "../../../.env"),
});

import { Worker, Queue } from "bullmq";
import { QUEUE_NAMES } from "@persona-lab/shared";
import type { SimulateEpisodeJob, SimulateAgentEpisodeJob, AggregateReportJob } from "@persona-lab/shared";
import { handleSimulateEpisode } from "./workers/simulate-episode.js";
import { handleSimulateAgentEpisode } from "./workers/simulate-agent-episode.js";
import { handleAggregateReport } from "./workers/aggregate-report.js";
import { getRedisOpts } from "./lib/redis.js";
import { prisma } from "./lib/prisma.js";

// Episodes stuck in RUNNING for longer than this are presumed dead (worker crash)
const STALE_EPISODE_MINUTES = 20;

/**
 * On startup, find any episodes left in RUNNING state from a previous crashed
 * worker and mark them FAILED so their runs can advance to aggregation.
 */
async function recoverStaleEpisodes() {
  const cutoff = new Date(Date.now() - STALE_EPISODE_MINUTES * 60 * 1000);

  const stale = await prisma.episode.findMany({
    where: { status: "RUNNING", updatedAt: { lt: cutoff } },
    select: { id: true, runId: true },
  });

  if (stale.length === 0) return;

  console.log(`[recovery] Found ${stale.length} stale episode(s) — marking FAILED`);

  await prisma.episode.updateMany({
    where: { id: { in: stale.map((e) => e.id) } },
    data: { status: "FAILED" },
  });

  // Advance each affected run (may now be ready to aggregate)
  const runIds = [...new Set(stale.map((e) => e.runId))];
  for (const runId of runIds) {
    await advanceRunIfDone(runId);
  }
}

async function advanceRunIfDone(runId: string) {
  const pendingOrRunning = await prisma.episode.count({
    where: { runId, status: { in: ["PENDING", "RUNNING"] } },
  });
  if (pendingOrRunning > 0) return;

  const run = await prisma.run.findUnique({ where: { id: runId }, select: { status: true } });
  if (!run || run.status === "COMPLETED" || run.status === "AGGREGATING" || run.status === "FAILED") return;

  console.log(`[recovery] Run ${runId.slice(0, 8)} — all episodes done, enqueuing aggregation`);
  await prisma.run.update({ where: { id: runId }, data: { status: "AGGREGATING" } });

  const q = new Queue(QUEUE_NAMES.AGGREGATE_REPORT, { connection: getRedisOpts() });
  await q.add(QUEUE_NAMES.AGGREGATE_REPORT, { runId } satisfies AggregateReportJob);
  await q.close();
}

// Validate required env vars
if (!process.env.OPENROUTER_API_KEY) {
  console.error("OPENROUTER_API_KEY is not set. Exiting.");
  process.exit(1);
}

const EPISODE_CONCURRENCY = parseInt(process.env.EPISODE_CONCURRENCY || "2", 10);
const AGENT_CONCURRENCY = parseInt(process.env.AGENT_CONCURRENCY || "2", 10);

const connection = getRedisOpts();

// Recover any episodes left RUNNING by a previously crashed worker
await recoverStaleEpisodes().catch((err) =>
  console.error("[recovery] Failed to recover stale episodes:", err)
);

console.log(`Concurrency: episode=${EPISODE_CONCURRENCY}, agent=${AGENT_CONCURRENCY}`);

const simulateEpisodeWorker = new Worker<SimulateEpisodeJob>(
  QUEUE_NAMES.SIMULATE_EPISODE,
  async (job) => {
    console.log(`[simulate_episode] Processing episode ${job.data.episodeId}`);
    await handleSimulateEpisode(job.data);
    console.log(`[simulate_episode] Done episode ${job.data.episodeId}`);
  },
  { connection, concurrency: EPISODE_CONCURRENCY }
);

const simulateAgentEpisodeWorker = new Worker<SimulateAgentEpisodeJob>(
  QUEUE_NAMES.SIMULATE_AGENT_EPISODE,
  async (job) => {
    console.log(`[simulate_agent_episode] Processing episode ${job.data.episodeId}`);
    await handleSimulateAgentEpisode(job.data);
    console.log(`[simulate_agent_episode] Done episode ${job.data.episodeId}`);
  },
  { connection, concurrency: AGENT_CONCURRENCY }
);

const aggregateReportWorker = new Worker<AggregateReportJob>(
  QUEUE_NAMES.AGGREGATE_REPORT,
  async (job) => {
    console.log(`[aggregate_report] Processing run ${job.data.runId}`);
    await handleAggregateReport(job.data);
    console.log(`[aggregate_report] Done run ${job.data.runId}`);
  },
  { connection, concurrency: 1 }
);

const workers = [simulateEpisodeWorker, simulateAgentEpisodeWorker, aggregateReportWorker];

for (const w of workers) {
  w.on("failed", (job, err) => {
    console.error(`[${w.name}] Job ${job?.id} failed:`, err.message);
    if (err.stack) console.error(err.stack);
  });
}

console.log("All workers running. Waiting for jobs...");

// Graceful shutdown
async function shutdown() {
  console.log("Shutting down workers...");
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
