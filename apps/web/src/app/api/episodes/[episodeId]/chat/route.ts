import { NextRequest } from "next/server";
import OpenAI from "openai";
import { buildEpisodeContext } from "@/lib/build-episode-context";

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

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ episodeId: string }> }
) {
  const { episodeId } = await params;
  const body = (await req.json()) as { messages: ChatMessage[] };

  console.log("=== PERSONA CHAT DEBUG ===");
  console.log("Episode ID:", episodeId);
  console.log("Messages:", body.messages);

  let ctx;
  try {
    ctx = await buildEpisodeContext(episodeId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("not found") ? 404 : 400;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { systemPrompt, model } = ctx;

  // Final prompt size guard
  if (systemPrompt.length > 8000) {
    console.error("Prompt too large:", systemPrompt.length);
    return new Response(JSON.stringify({ error: "Journey context too large for processing" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  console.log("=== PROMPT DEBUG ===");
  console.log("System prompt length:", systemPrompt.length);
  console.log("System prompt preview:", systemPrompt.slice(0, 1000) + (systemPrompt.length > 1000 ? "..." : ""));
  console.log("=== END PROMPT DEBUG ===");

  const openai = getClient();

  console.log("=== OPENAI CALL DEBUG ===");
  console.log("Model:", model);
  console.log("Messages count:", body.messages.length + 1);

  try {
    const stream = await openai.chat.completions.create({
      model,
      stream: true,
      messages: [
        { role: "system" as const, content: systemPrompt },
        ...body.messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ],
      temperature: 0.7,
      max_tokens: 1024,
    });

    console.log("OpenAI stream created successfully");

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            controller.enqueue(encoder.encode(delta));
          }
        }
        controller.close();
      } catch (err) {
        console.error("Stream error:", err);
        controller.error(err);
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
    },
  });
  } catch (error) {
    console.error("OpenAI API error:", error);
    return new Response(JSON.stringify({ error: "Failed to generate response" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
