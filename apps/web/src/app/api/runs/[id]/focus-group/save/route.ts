import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: runId } = await params;
  const body = (await req.json()) as { transcript: unknown };

  if (!body.transcript) {
    return NextResponse.json({ error: "transcript is required" }, { status: 400 });
  }

  const run = await prisma.run.findUnique({ where: { id: runId } });
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const session = await prisma.focusGroupSession.create({
    data: {
      runId,
      transcript: body.transcript as object,
    },
  });

  return NextResponse.json({ id: session.id }, { status: 201 });
}
