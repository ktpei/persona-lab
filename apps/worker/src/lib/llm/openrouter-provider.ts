import OpenAI from "openai";
import type { ZodSchema } from "zod";
import type { LLMProvider } from "@persona-lab/shared";

export class OpenRouterProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;

  constructor(model: string) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY is not set");
    }

    this.client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey,
      timeout: 90_000, // 90s — prevent hung LLM calls from stalling the agent forever
    });
    this.model = model;
  }

  async completeJSON<T>(prompt: string, schema: ZodSchema<T>): Promise<T> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: "system",
          content:
            "You are a precise JSON generator. Always respond with valid JSON only, no markdown formatting or extra text.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const text = response.choices[0]?.message?.content;
    if (!text) {
      throw new Error("No response from LLM");
    }

    const parsed = JSON.parse(text);
    return schema.parse(parsed);
  }

  async completeJSONWithImage<T>(imageBuffer: Buffer, prompt: string, schema: ZodSchema<T>): Promise<T> {
    const base64 = imageBuffer.toString("base64");
    const dataUrl = `data:image/png;base64,${base64}`;

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: "system",
          content:
            "You are a precise JSON generator. Always respond with valid JSON only, no markdown formatting or extra text.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const text = response.choices[0]?.message?.content;
    if (!text) {
      throw new Error("No response from LLM for image+JSON");
    }

    const parsed = JSON.parse(text);
    return schema.parse(parsed);
  }

  async describeImage(imageBuffer: Buffer, prompt: string): Promise<string> {
    const base64 = imageBuffer.toString("base64");
    const dataUrl = `data:image/png;base64,${base64}`;

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      temperature: 0.2,
    });

    const text = response.choices[0]?.message?.content;
    if (!text) {
      throw new Error("No response from LLM for image description");
    }
    return text;
  }
}

export function createLLMProvider(model: string): LLMProvider {
  return new OpenRouterProvider(model);
}
