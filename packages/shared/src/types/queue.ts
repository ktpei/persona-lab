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

export interface AggregateReportJob {
  runId: string;
}
