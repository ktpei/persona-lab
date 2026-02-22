import { prisma } from "@/lib/prisma";
import { buildPersonaContext, DEFAULT_MODEL } from "@persona-lab/shared";

interface StepReasoning {
  salient?: string;
  confusions?: Array<{ issue: string; evidence: string }>;
  likelyAction?: string;
  browserAction?: { type: string; [key: string]: unknown };
  intent?: string;
  confidence?: number;
  friction?: number;
}

export interface EpisodeContext {
  systemPrompt: string;
  persona: {
    name: string;
    gender: string | null;
    ageGroup: string | null;
    traits: unknown;
  };
  model: string;
  flowName: string;
  outcome: string;
}

export async function buildEpisodeContext(episodeId: string): Promise<EpisodeContext> {
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
        take: 50,
      },
    },
  });

  if (!episode) throw new Error("Episode not found");
  if (!episode.persona) throw new Error("Episode has no persona");
  if (!episode.run) throw new Error("Episode has no run");
  if (!episode.run.flow) throw new Error("Episode run has no flow");

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

    if (!r) {
      parts.push("No reasoning data available.");
      journeyLines.push(parts.join(" "));
      continue;
    }

    if (r.salient && typeof r.salient === "string" && r.salient.length < 200) {
      parts.push(`I noticed: ${r.salient}.`);
    }

    if (r.confusions && Array.isArray(r.confusions) && r.confusions.length > 0) {
      const issues = r.confusions
        .slice(0, 3)
        .map((c) => {
          if (c.issue && typeof c.issue === "string" && c.issue.length < 100) {
            return c.issue;
          }
          return "confusion";
        })
        .join("; ");
      parts.push(`My confusions: ${issues}.`);
    }

    const action = r?.intent ?? r?.likelyAction;
    if (action) parts.push(`I chose to: ${action}.`);
    if (r?.browserAction) parts.push(`Browser action: ${r.browserAction.type}.`);
    if (r?.confidence != null) parts.push(`Confidence: ${r.confidence.toFixed(2)}.`);
    if (r?.friction != null) parts.push(`Friction: ${r.friction.toFixed(2)}.`);

    journeyLines.push(parts.join(" "));

    if (journeyLines.length >= 20) {
      journeyLines.push("... (additional steps omitted for brevity)");
      break;
    }
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
You just went through UX flow "${flowName}" and ${outcome}. Here is what happened at each step:

${journeyLines.join("\n")}

## Instructions
You ARE ${episode.persona.name}. Speak in the first person. When the user asks you questions about your experience, reference your actual journey above. Stay in character — respond as this persona would, reflecting your behavioral traits, frustrations, and observations. Be specific about what you saw and felt. Keep answers conversational and concise.`;

  return {
    systemPrompt,
    persona: {
      name: episode.persona.name,
      gender: episode.persona.gender,
      ageGroup: episode.persona.ageGroup,
      traits: episode.persona.traits,
    },
    model,
    flowName,
    outcome,
  };
}
