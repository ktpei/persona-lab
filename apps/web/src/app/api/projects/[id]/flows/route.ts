import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  const flows = await prisma.flow.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { frames: true } } },
  });

  return NextResponse.json(flows);
}
