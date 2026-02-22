import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { DEFAULT_MODEL } from "@persona-lab/shared";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ findingId: string }> }
) {
  const { findingId } = await params;
  const body = await req.json().catch(() => ({}));
  const regenerate = body.regenerate === true;

  const finding = await prisma.finding.findUnique({
    where: { id: findingId },
    include: {
      run: {
        include: {
          flow: { select: { name: true, goal: true, url: true } },
        },
      },
    },
  });

  if (!finding) {
    return NextResponse.json({ error: "Finding not found" }, { status: 404 });
  }

  // Return cached fix if available and not regenerating
  if (finding.recommendedFix && !regenerate) {
    return NextResponse.json({ fix: finding.recommendedFix });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENROUTER_API_KEY not set" },
      { status: 500 }
    );
  }

  const affectedPersonas = finding.affectedPersonas as string[];
  const flow = finding.run.flow;

  const prompt = `You are a UX/UI design consultant. Given the following usability issue found during a simulated user test, provide a specific, actionable fix recommendation in 2-4 sentences. Be concrete about what UI element to change and how.

Flow: "${flow.name}"${flow.goal ? ` — Goal: "${flow.goal}"` : ""}${flow.url ? ` — URL: ${flow.url}` : ""}

Issue: ${finding.issue}
Evidence: ${finding.evidence}
Severity: ${finding.severity.toFixed(2)}
Frequency: reported ${finding.frequency} time(s)
Affected personas: ${affectedPersonas.join(", ")}${finding.elementRef ? `\nElement: ${finding.elementRef}` : ""}

Write the recommended fix now:`;

  const openai = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
  });

  const res = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_tokens: 300,
  });

  const fix = res.choices[0]?.message?.content?.trim() ?? "";

  if (fix) {
    await prisma.finding.update({
      where: { id: findingId },
      data: { recommendedFix: fix },
    });
  }

  return NextResponse.json({ fix });
}
