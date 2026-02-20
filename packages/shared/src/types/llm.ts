import type { ZodSchema } from "zod";

export interface LLMProvider {
  completeJSON<T>(prompt: string, schema: ZodSchema<T>): Promise<T>;
  completeJSONWithImage<T>(imageBuffer: Buffer, prompt: string, schema: ZodSchema<T>): Promise<T>;
  describeImage(imageBuffer: Buffer, prompt: string): Promise<string>;
}
