import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  const runs = await prisma.run.findMany({
    where: { flow: { projectId } },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { findings: true, episodes: true } },
      flow: { select: { name: true } },
    },
  });

  return NextResponse.json(runs);
}
