import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const flow = await prisma.flow.findUnique({
    where: { id },
    include: {
      frames: { orderBy: { stepIndex: "asc" } },
    },
  });

  if (!flow) {
    return NextResponse.json({ error: "Flow not found" }, { status: 404 });
  }

  return NextResponse.json(flow);
}

const UpdateFlowInput = z.object({
  name: z.string().min(1).optional(),
  url: z.string().url().optional().nullable(),
  goal: z.string().optional().nullable(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const input = UpdateFlowInput.parse(body);

  const flow = await prisma.flow.update({
    where: { id },
    data: input,
  });

  return NextResponse.json(flow);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  await prisma.flow.delete({ where: { id } });

  return new NextResponse(null, { status: 204 });
}
