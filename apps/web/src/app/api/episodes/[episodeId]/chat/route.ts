import { NextRequest } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { buildPersonaContext, DEFAULT_MODEL } from "@persona-lab/shared";

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

interface StepReasoning {
  salient?: string;
  confusions?: Array<{ issue: string; evidence: string }>;
  likelyAction?: string;
  confidence?: number;
  friction?: number;
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

  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    include: {
      persona: true,
      run: {
        include: {
          flow: { select: { name: true } },
        },
      },
      steps: {
        orderBy: { stepIndex: "asc" },
        include: {
          frame: { select: { stepIndex: true } },
        },
        take: 50, // Limit steps to prevent huge prompts
      },
    },
  });

  console.log("=== DATA INSPECTION ===");
  console.log("Episode data size:", JSON.stringify(episode).length);
  console.log("Persona:", episode?.persona ? "PRESENT" : "MISSING");
  console.log("Run:", episode?.run ? "PRESENT" : "MISSING");
  console.log("Flow:", episode?.run?.flow ? "PRESENT" : "MISSING");
  console.log("Steps count:", episode?.steps?.length || 0);

  // Defensive guards
  if (!episode) {
    return new Response(JSON.stringify({ error: "Episode not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!episode.persona) {
    return new Response(JSON.stringify({ error: "Episode has no persona" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!episode.run) {
    return new Response(JSON.stringify({ error: "Episode has no run" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!episode.run.flow) {
    return new Response(JSON.stringify({ error: "Episode run has no flow" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const personaContext = buildPersonaContext(episode.persona);
  const flowName = episode.run.flow.name;
  const config = episode.run.config as { model?: string } | null;
  const model = config?.model ?? DEFAULT_MODEL;

  // Build journey summary from step traces
  const journeyLines: string[] = [];
  for (const step of episode.steps) {
    const r = step.reasoning as StepReasoning | null;
    const frameIdx = step.frame.stepIndex;
    const parts: string[] = [`Frame ${frameIdx + 1} (step ${step.stepIndex + 1}):`];

    // Defensive: Handle null/undefined reasoning
    if (!r) {
      parts.push("No reasoning data available.");
      journeyLines.push(parts.join(" "));
      continue;
    }

    // Extract only essential fields, limit size
    if (r.salient && typeof r.salient === "string" && r.salient.length < 200) {
      parts.push(`I noticed: ${r.salient}.`);
    }
    
    if (r.confusions && Array.isArray(r.confusions) && r.confusions.length > 0) {
      const issues = r.confusions
        .slice(0, 3) // Limit confusions
        .map((c) => {
          if (c.issue && typeof c.issue === "string" && c.issue.length < 100) {
            return c.issue;
          }
          return "confusion";
        })
        .join("; ");
      parts.push(`My confusions: ${issues}.`);
    }
    
    if (r.likelyAction && typeof r.likelyAction === "string" && r.likelyAction.length < 100) {
      parts.push(`I chose to: ${r.likelyAction}.`);
    }
    
    if (typeof r.confidence === "number" && r.confidence >= 0 && r.confidence <= 1) {
      parts.push(`Confidence: ${r.confidence.toFixed(2)}.`);
    }
    
    if (typeof r.friction === "number" && r.friction >= 0 && r.friction <= 1) {
      parts.push(`Friction: ${r.friction.toFixed(2)}.`);
    }

    journeyLines.push(parts.join(" "));
    
    // Prevent overly long journeys
    if (journeyLines.length >= 20) {
      journeyLines.push("... (additional steps omitted for brevity)");
      break;
    }
  }

  const outcome = episode.status === "COMPLETED" ? "completed the flow" : "abandoned the flow";

  const systemPrompt = `${personaContext}

## Your Journey
You just went through UX flow "${flowName}" and ${outcome}. Here is what happened at each step:

${journeyLines.join("\n")}

## Instructions
You ARE ${episode.persona.name}. Speak in the first person. When the user asks you questions about your experience, reference your actual journey above. Stay in character — respond as this persona would, reflecting your behavioral traits, frustrations, and observations. Be specific about what you saw and felt. Keep answers conversational and concise.`;

  // Final prompt size guard
  if (systemPrompt.length > 8000) {
    console.error("Prompt too large:", systemPrompt.length);
    return new Response(JSON.stringify({ error: "Journey context too large for processing" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  console.log("=== PROMPT DEBUG ===");
  console.log("Persona context length:", personaContext.length);
  console.log("Journey lines length:", journeyLines.length);
  console.log("System prompt length:", systemPrompt.length);
  console.log("System prompt preview:", systemPrompt.slice(0, 1000) + (systemPrompt.length > 1000 ? "..." : ""));
  console.log("=== END PROMPT DEBUG ===");

  const openai = getClient();

  console.log("=== OPENAI CALL DEBUG ===");
  console.log("Model:", model);
  console.log("Messages count:", body.messages.length + 1); // +1 for system

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
