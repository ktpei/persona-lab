import OpenAI from "openai";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");
    client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey,
    });
  }
  return client;
}

export async function generateNames(count: number): Promise<string[]> {
  const openai = getClient();
  const response = await openai.chat.completions.create({
    model: "google/gemini-2.5-flash",
    messages: [
      {
        role: "system",
        content:
          "You generate realistic first names for user personas. Respond with valid JSON only.",
      },
      {
        role: "user",
        content: `Generate ${count} diverse, realistic first names (mix of genders, ethnicities). Return JSON: { "names": ["name1", "name2", ...] }`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.9,
  });

  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error("No response from LLM");

  const parsed = JSON.parse(text) as { names: string[] };
  return parsed.names.slice(0, count);
}
