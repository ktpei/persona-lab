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
  browserAction?: { type: string; [key: string]: unknown };
  intent?: string;
  confidence?: number;
  friction?: number;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ episodeId: string }> }
) {
  const { episodeId } = await params;
  const body = (await req.json()) as { messages: ChatMessage[] };

  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    include: {
      persona: true,
      run: {
        include: {
          flow: { select: { name: true, mode: true } },
        },
      },
      steps: {
        orderBy: { stepIndex: "asc" },
        include: {
          frame: { select: { stepIndex: true } },
        },
      },
    },
  });

  if (!episode) {
    return new Response(JSON.stringify({ error: "Episode not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const personaContext = buildPersonaContext(episode.persona);
  const flowName = episode.run.flow.name;
  const config = episode.run.config as { model?: string } | null;
  const model = config?.model ?? DEFAULT_MODEL;

  const isAgentMode = episode.run.flow.mode === "AGENT";

  // Build journey summary from step traces
  const journeyLines: string[] = [];
  for (const step of episode.steps) {
    const r = step.reasoning as StepReasoning | null;
    const obs = step.observation as { url?: string; pageTitle?: string } | null;

    let locationLabel: string;
    if (isAgentMode && obs?.url) {
      try {
        const pathname = new URL(obs.url).pathname;
        locationLabel = `Page "${obs.pageTitle || pathname}" (${pathname})`;
      } catch {
        locationLabel = `Page (step ${step.stepIndex + 1})`;
      }
    } else {
      const frameIdx = step.frame?.stepIndex ?? step.stepIndex;
      locationLabel = `Frame ${frameIdx + 1}`;
    }

    const parts: string[] = [`${locationLabel} (step ${step.stepIndex + 1}):`];

    if (r?.salient) parts.push(`I noticed: ${r.salient}.`);
    if (r?.confusions && r.confusions.length > 0) {
      const issues = r.confusions.map((c) => c.issue).join("; ");
      parts.push(`My confusions: ${issues}.`);
    }
    // Use intent for agent mode, likelyAction for screenshot mode
    const action = r?.intent ?? r?.likelyAction;
    if (action) parts.push(`I chose to: ${action}.`);
    if (r?.browserAction) parts.push(`Browser action: ${r.browserAction.type}.`);
    if (r?.confidence != null) parts.push(`Confidence: ${r.confidence.toFixed(2)}.`);
    if (r?.friction != null) parts.push(`Friction: ${r.friction.toFixed(2)}.`);

    journeyLines.push(parts.join(" "));
  }

  const outcome = episode.status === "COMPLETED" ? "completed the flow" : "abandoned the flow";

  const totalSteps = episode.steps.length;
  const avgFriction =
    totalSteps > 0
      ? episode.steps.reduce((sum, s) => sum + s.friction, 0) / totalSteps
      : 0;
  const avgConfidence =
    totalSteps > 0
      ? episode.steps.reduce((sum, s) => sum + s.confidence, 0) / totalSteps
      : 0;

  const systemPrompt = `${personaContext}

## Your Journey Summary
- Total steps taken: ${totalSteps}
- Average friction across your journey: ${avgFriction.toFixed(2)}
- Average confidence across your journey: ${avgConfidence.toFixed(2)}
- Outcome: ${outcome}

When asked about your overall friction, step count, or confidence, refer to these summary numbers. Individual step details are below.

## Your Journey
You just went through the UX flow "${flowName}" and ${outcome}. Here is what happened at each step:

${journeyLines.join("\n")}

## Instructions
You ARE ${episode.persona.name}. Speak in the first person. When the user asks you questions about your experience, reference your actual journey above. Stay in character — respond as this persona would, reflecting your behavioral traits, frustrations, and observations. Be specific about what you saw and felt. Keep answers conversational and concise.`;

  const openai = getClient();

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
}
