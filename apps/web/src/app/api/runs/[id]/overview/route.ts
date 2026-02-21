import { NextRequest } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";

const OVERVIEW_MODEL = "anthropic/claude-haiku-4-5";

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");
    client = new OpenAI({ baseURL: "https://openrouter.ai/api/v1", apiKey });
  }
  return client;
}

interface Finding {
  issue: string;
  severity: number;
  frequency: number;
  affectedPersonas: string[];
  screenIndex?: number;
}

interface ReportSummary {
  totalEpisodes: number;
  completedEpisodes: number;
  abandonedEpisodes: number;
  avgFriction: number;
  avgDropoffRisk: number;
}

interface Report {
  summary: ReportSummary;
  findings: Finding[];
  perScreen?: Array<{ screenIndex: number; screenLabel?: string }>;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: runId } = await params;

  const run = await prisma.run.findUnique({
    where: { id: runId },
    select: {
      reportJson: true,
      flow: { select: { name: true, mode: true } },
    },
  });

  if (!run?.reportJson) {
    return new Response(JSON.stringify({ error: "Report not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const report = run.reportJson as unknown as Report;
  const { summary, findings, perScreen } = report;

  const screenLabels = new Map<number, string>();
  for (const s of perScreen ?? []) {
    if (s.screenLabel) screenLabels.set(s.screenIndex, s.screenLabel);
  }

  const isAgentMode = run.flow.mode === "AGENT";
  const pageOrFrame = isAgentMode ? "page" : "frame";

  const top = [...findings].sort((a, b) => b.severity - a.severity).slice(0, 5);

  const findingLines = top
    .map((f, i) => {
      const loc =
        f.screenIndex != null
          ? screenLabels.get(f.screenIndex) || `${pageOrFrame} ${f.screenIndex + 1}`
          : null;
      const personas = f.affectedPersonas.join(", ");
      return `${i + 1}. "${f.issue}" — severity ${f.severity.toFixed(2)}, reported ${f.frequency}x${loc ? `, on ${loc}` : ""}. Affected personas: ${personas}.`;
    })
    .join("\n");

  const prompt = `You are a UX research analyst. Summarize the following usability simulation results in 3–4 fluent sentences. Write in third-person analytical voice — never use "I", "I'm", "I've", or any first-person language. Be specific: name the key friction points, which screens or steps caused problems, and which types of users were most affected. Do not invent anything not present in the data.

Flow: "${run.flow.name}"
Personas simulated: ${summary.totalEpisodes} (${summary.completedEpisodes} completed, ${summary.abandonedEpisodes} dropped off)
Average friction: ${summary.avgFriction.toFixed(2)} | Average drop-off risk: ${summary.avgDropoffRisk.toFixed(2)}

Top findings:
${findingLines}

Write the summary paragraph now:`;

  const openai = getClient();
  const res = await openai.chat.completions.create({
    model: OVERVIEW_MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_tokens: 300,
  });

  const overview = res.choices[0]?.message?.content?.trim() ?? "";

  return new Response(JSON.stringify({ overview }), {
    headers: { "Content-Type": "application/json" },
  });
}
