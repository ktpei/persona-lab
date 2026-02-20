import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const run = await prisma.run.findUnique({
    where: { id },
    include: {
      episodes: {
        include: {
          persona: true,
          _count: { select: { steps: true } },
        },
      },
      _count: { select: { findings: true } },
    },
  });

  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  return NextResponse.json(run);
}
