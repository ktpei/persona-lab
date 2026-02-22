import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Load .env — use DOTENV_PATH if set (e.g. /app/.env in Docker), else repo root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({
  path: process.env.DOTENV_PATH || path.resolve(__dirname, "../../../.env"),
});

import { Worker } from "bullmq";
import Docker from "dockerode";
import { QUEUE_NAMES } from "@persona-lab/shared";
import type { SimulateEpisodeJob, SimulateAgentEpisodeJob, AggregateReportJob } from "@persona-lab/shared";
import { handleSimulateEpisode } from "./workers/simulate-episode.js";
import { handleSimulateAgentEpisode } from "./workers/simulate-agent-episode.js";
import { handleAggregateReport } from "./workers/aggregate-report.js";
import { getRedisOpts } from "./lib/redis.js";

// Validate required env vars
if (!process.env.OPENROUTER_API_KEY) {
  console.error("OPENROUTER_API_KEY is not set. Exiting.");
  process.exit(1);
}

const EPISODE_CONCURRENCY = parseInt(process.env.EPISODE_CONCURRENCY || "2", 10);
const AGENT_CONCURRENCY = parseInt(process.env.AGENT_CONCURRENCY || "2", 10);

const connection = getRedisOpts();

console.log(`Concurrency: episode=${EPISODE_CONCURRENCY}, agent=${AGENT_CONCURRENCY}`);

// BullMQ lock duration must exceed the longest single step.
// Agent episodes do LLM vision calls that can take 30-60s each,
// plus browser actions, screenshots, and DB writes.
// 5 minutes gives ample headroom so jobs aren't falsely stalled.
const LOCK_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const LOCK_RENEW_TIME_MS = LOCK_DURATION_MS / 2; // renew halfway through

const simulateEpisodeWorker = new Worker<SimulateEpisodeJob>(
  QUEUE_NAMES.SIMULATE_EPISODE,
  async (job) => {
    console.log(`[simulate_episode] Processing episode ${job.data.episodeId}`);
    await handleSimulateEpisode(job.data);
    console.log(`[simulate_episode] Done episode ${job.data.episodeId}`);
  },
  {
    connection,
    concurrency: EPISODE_CONCURRENCY,
    lockDuration: LOCK_DURATION_MS,
    lockRenewTime: LOCK_RENEW_TIME_MS,
    stalledInterval: 60_000, // check for stalled jobs every 60s (not default 30s)
  }
);

const simulateAgentEpisodeWorker = new Worker<SimulateAgentEpisodeJob>(
  QUEUE_NAMES.SIMULATE_AGENT_EPISODE,
  async (job) => {
    console.log(`[simulate_agent_episode] Processing episode ${job.data.episodeId}`);
    await handleSimulateAgentEpisode(job.data);
    console.log(`[simulate_agent_episode] Done episode ${job.data.episodeId}`);
  },
  {
    connection,
    concurrency: AGENT_CONCURRENCY,
    lockDuration: LOCK_DURATION_MS,
    lockRenewTime: LOCK_RENEW_TIME_MS,
    stalledInterval: 60_000,
  }
);

const aggregateReportWorker = new Worker<AggregateReportJob>(
  QUEUE_NAMES.AGGREGATE_REPORT,
  async (job) => {
    console.log(`[aggregate_report] Processing run ${job.data.runId}`);
    await handleAggregateReport(job.data);
    console.log(`[aggregate_report] Done run ${job.data.runId}`);
  },
  {
    connection,
    concurrency: 1,
    lockDuration: LOCK_DURATION_MS,
    lockRenewTime: LOCK_RENEW_TIME_MS,
  }
);

const workers = [simulateEpisodeWorker, simulateAgentEpisodeWorker, aggregateReportWorker];

for (const w of workers) {
  w.on("failed", (job, err) => {
    console.error(`[${w.name}] Job ${job?.id} failed:`, err.message);
    if (err.stack) console.error(err.stack);
  });
  w.on("stalled", (jobId) => {
    console.warn(`[${w.name}] Job ${jobId} STALLED — lock expired before job finished. This usually means an LLM call or browser action hung.`);
  });
  w.on("error", (err) => {
    console.error(`[${w.name}] Worker error:`, err.message);
  });
}

// Clean up orphaned persona-browser containers from previous crashes
async function cleanOrphanedContainers() {
  if (process.env.BROWSER_MODE === "local") return;
  try {
    const docker = new Docker();
    const containers = await docker.listContainers({
      all: true,
      filters: { ancestor: ["persona-browser"] },
    });
    if (containers.length > 0) {
      console.log(`[cleanup] Found ${containers.length} orphaned persona-browser container(s), removing...`);
      for (const c of containers) {
        try {
          const container = docker.getContainer(c.Id);
          await container.stop({ t: 3 }).catch(() => {});
          await container.remove({ force: true }).catch(() => {});
          console.log(`[cleanup] Removed container ${c.Id.slice(0, 12)}`);
        } catch {
          // Already gone
        }
      }
    } else {
      console.log("[cleanup] No orphaned containers found");
    }
  } catch (err) {
    console.warn("[cleanup] Could not check for orphaned containers:", err instanceof Error ? err.message : err);
  }
}

await cleanOrphanedContainers();
console.log("All workers running. Waiting for jobs...");

// Graceful shutdown — also kill any remaining containers
async function shutdown() {
  console.log("Shutting down workers...");
  await Promise.all(workers.map((w) => w.close()));
  await cleanOrphanedContainers();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
