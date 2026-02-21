import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CreateFlowInput = z.object({
  projectId: z.string(),
  name: z.string().min(1),
  mode: z.enum(["SCREENSHOT", "AGENT"]).optional().default("SCREENSHOT"),
  url: z.string().url().optional(),
  goal: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const input = CreateFlowInput.parse(body);

  // Validate agent-mode required fields
  if (input.mode === "AGENT") {
    if (!input.url) {
      return NextResponse.json({ error: "URL is required for agent mode" }, { status: 400 });
    }
    if (!input.goal) {
      return NextResponse.json({ error: "Goal is required for agent mode" }, { status: 400 });
    }
  }

  const flow = await prisma.flow.create({
    data: {
      projectId: input.projectId,
      name: input.name,
      mode: input.mode,
      url: input.url,
      goal: input.goal,
    },
  });

  return NextResponse.json(flow, { status: 201 });
}
