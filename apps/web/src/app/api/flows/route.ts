import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CreateFlowInput = z.object({
  projectId: z.string(),
  name: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const input = CreateFlowInput.parse(body);

  const flow = await prisma.flow.create({
    data: input,
  });

  return NextResponse.json(flow, { status: 201 });
}
