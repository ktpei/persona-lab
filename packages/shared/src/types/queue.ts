export interface ParseFrameJob {
  frameId: string;
  model: string;
}

export interface SimulateEpisodeJob {
  episodeId: string;
  runId: string;
  model: string;
  maxSteps: number;
  seed?: number;
}

export interface SimulateAgentEpisodeJob {
  episodeId: string;
  runId: string;
  model: string;
  maxSteps: number;
  url: string;
  goal: string;
}

export interface AggregateReportJob {
  runId: string;
}
