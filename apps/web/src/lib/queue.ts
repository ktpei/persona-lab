import { Queue } from "bullmq";
import { QUEUE_NAMES } from "@persona-lab/shared";

function getRedisOpts() {
  const url = new URL(process.env.REDIS_URL || "redis://localhost:6379");
  return {
    host: url.hostname,
    port: Number(url.port) || 6379,
    maxRetriesPerRequest: null as null,
    lazyConnect: true,
  };
}

let _parseFrameQueue: Queue | null = null;
let _simulateEpisodeQueue: Queue | null = null;
let _aggregateReportQueue: Queue | null = null;

export const parseFrameQueue = {
  add: async (...args: Parameters<Queue["add"]>) => {
    if (!_parseFrameQueue) {
      _parseFrameQueue = new Queue(QUEUE_NAMES.PARSE_FRAME, { connection: getRedisOpts() });
    }
    return _parseFrameQueue.add(...args);
  },
};

export const simulateEpisodeQueue = {
  add: async (...args: Parameters<Queue["add"]>) => {
    if (!_simulateEpisodeQueue) {
      _simulateEpisodeQueue = new Queue(QUEUE_NAMES.SIMULATE_EPISODE, { connection: getRedisOpts() });
    }
    return _simulateEpisodeQueue.add(...args);
  },
};

export const aggregateReportQueue = {
  add: async (...args: Parameters<Queue["add"]>) => {
    if (!_aggregateReportQueue) {
      _aggregateReportQueue = new Queue(QUEUE_NAMES.AGGREGATE_REPORT, { connection: getRedisOpts() });
    }
    return _aggregateReportQueue.add(...args);
  },
};
