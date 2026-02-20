import { z } from "zod";
import { DEFAULT_MODEL, MAX_STEPS_DEFAULT } from "../constants.js";

export const RunConfig = z.object({
  model: z.string().default(DEFAULT_MODEL),
  maxSteps: z.number().int().positive().default(MAX_STEPS_DEFAULT),
  seed: z.number().int().optional(),
});

export type RunConfig = z.infer<typeof RunConfig>;
