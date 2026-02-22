import { NextRequest } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { buildPersonaContext } from "@persona-lab/shared";

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

interface StepReasoning {
  salient?: string;
  confusions?: Array<{ issue: string; evidence: string }>;
  likelyAction?: string;
  intent?: string;
  confidence?: number;
  friction?: number;
}

interface FocusGroupMessage {
  role: "user" | "persona";
  personaName?: string;
  text: string;
}

async function buildFocusGroupContext(runId: string) {
  const run = await prisma.run.findUnique({
    where: { id: runId },
    include: {
      flow: { select: { name: true, mode: true } },
      episodes: {
        include: {
          persona: true,
          steps: {
            orderBy: { stepIndex: "asc" },
            take: 20,
          },
        },
      },
    },
  });

  if (!run) throw new Error("Run not found");
  if (!run.flow) throw new Error("Run has no flow");

  const config = run.config as { model?: string } | null;
  const model = config?.model ?? "google/gemini-2.5-flash";
  const isAgentMode = run.flow.mode === "AGENT";

  const personaContexts = run.episodes.map((episode) => {
    const personaDesc = buildPersonaContext(episode.persona);

    const journeyLines: string[] = [];
    for (const step of episode.steps) {
      const r = step.reasoning as StepReasoning | null;
      const obs = step.observation as { url?: string; pageTitle?: string } | null;

      let locationLabel: string;
      if (isAgentMode && obs?.url) {
        try {
          const pathname = new URL(obs.url).pathname;
          locationLabel = `Page "${obs.pageTitle || pathname}"`;
        } catch {
          locationLabel = `Step ${step.stepIndex + 1}`;
        }
      } else {
        locationLabel = `Screen ${step.stepIndex + 1}`;
      }

      const parts: string[] = [`${locationLabel}:`];
      if (r?.salient) parts.push(r.salient);
      if (r?.confusions?.length) {
        parts.push(`Confused by: ${r.confusions.map((c) => c.issue).join("; ")}`);
      }
      const action = r?.intent ?? r?.likelyAction;
      if (action) parts.push(`Action: ${action}`);
      if (r?.friction != null) parts.push(`Friction: ${r.friction.toFixed(2)}`);

      journeyLines.push(parts.join(" "));
      if (journeyLines.length >= 10) break;
    }

    const totalSteps = episode.steps.length;
    const avgFriction =
      totalSteps > 0
        ? episode.steps.reduce((sum, s) => sum + s.friction, 0) / totalSteps
        : 0;
    const outcome =
      episode.status === "COMPLETED" ? "completed the flow" : "abandoned the flow";

    return {
      personaId: episode.persona.id,
      name: episode.persona.name,
      gender: episode.persona.gender,
      ageGroup: episode.persona.ageGroup,
      traits: episode.persona.traits as Record<string, number> | null,
      context: `### ${episode.persona.name}
${personaDesc}

Journey through "${run.flow!.name}" (${outcome}, ${totalSteps} steps, avg friction ${avgFriction.toFixed(2)}):
${journeyLines.join("\n")}`,
    };
  });

  return { personaContexts, model, flowName: run.flow.name };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: runId } = await params;
  const body = (await req.json()) as { messages: FocusGroupMessage[] };

  let ctx;
  try {
    ctx = await buildFocusGroupContext(runId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: message.includes("not found") ? 404 : 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { personaContexts, model, flowName } = ctx;
  const participantNames = personaContexts.map((p) => p.name);

  const systemPrompt = `You are moderating a focus group discussion about a UX flow called "${flowName}".

The following personas participated in this flow. Each has a distinct personality and experienced the journey differently:

${personaContexts.map((p) => p.context).join("\n\n")}

## Instructions

You generate responses AS the personas above in a focus group discussion. The user (a UX researcher) will ask questions and the personas respond.

Rules:
1. For each user question, generate responses from 2-5 of the most relevant personas.
2. Personas should react to each other — agree, disagree, or build on each other's points.
3. If the user addresses a specific persona by name (e.g. "Aaliyah, what did you think?"), ONLY that persona responds.
4. Keep each persona's response to 2-3 sentences. Stay in character for each persona based on their traits and journey.
5. Reference specific moments from each persona's actual journey when relevant.
6. Output ONLY a valid JSON array of objects. No markdown, no code fences, no explanation.

Output format (JSON array only):
[{"personaId": "...", "name": "PersonaName", "text": "Their response..."}, ...]

Available personas: ${participantNames.join(", ")}`;

  const openai = getClient();

  // Build message history for the LLM
  const llmMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
  ];

  for (const msg of body.messages) {
    if (msg.role === "user") {
      llmMessages.push({ role: "user", content: msg.text });
    } else if (msg.role === "persona") {
      // Previous persona responses go as assistant messages
      llmMessages.push({
        role: "assistant",
        content: msg.text,
      });
    }
  }

  try {
    const completion = await openai.chat.completions.create({
      model,
      messages: llmMessages,
      temperature: 0.7,
      max_tokens: 2048,
    });

    const rawContent = completion.choices[0]?.message?.content ?? "[]";

    // Parse the JSON response — strip code fences if present
    let cleaned = rawContent.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    let responses: Array<{ personaId: string; name: string; text: string }>;
    try {
      responses = JSON.parse(cleaned);
      if (!Array.isArray(responses)) {
        responses = [responses];
      }
    } catch {
      // If JSON parsing fails, try to create a single response
      responses = [
        {
          personaId: personaContexts[0]?.personaId ?? "",
          name: personaContexts[0]?.name ?? "Participant",
          text: rawContent,
        },
      ];
    }

    // Validate and fill in missing personaIds
    const nameToId = new Map(personaContexts.map((p) => [p.name.toLowerCase(), p.personaId]));
    responses = responses.map((r) => ({
      ...r,
      personaId: r.personaId || nameToId.get(r.name?.toLowerCase()) || "",
    }));

    return new Response(JSON.stringify({ responses }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Focus group orchestrator error:", error);
    return new Response(JSON.stringify({ error: "Failed to generate responses" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
