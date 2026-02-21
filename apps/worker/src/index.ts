import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Load .env from repo root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { Worker } from "bullmq";
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

const connection = getRedisOpts();

const simulateEpisodeWorker = new Worker<SimulateEpisodeJob>(
  QUEUE_NAMES.SIMULATE_EPISODE,
  async (job) => {
    console.log(`[simulate_episode] Processing episode ${job.data.episodeId}`);
    await handleSimulateEpisode(job.data);
    console.log(`[simulate_episode] Done episode ${job.data.episodeId}`);
  },
  { connection, concurrency: 2 }
);

const simulateAgentEpisodeWorker = new Worker<SimulateAgentEpisodeJob>(
  QUEUE_NAMES.SIMULATE_AGENT_EPISODE,
  async (job) => {
    console.log(`[simulate_agent_episode] Processing episode ${job.data.episodeId}`);
    await handleSimulateAgentEpisode(job.data);
    console.log(`[simulate_agent_episode] Done episode ${job.data.episodeId}`);
  },
  { connection, concurrency: 2 }
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
