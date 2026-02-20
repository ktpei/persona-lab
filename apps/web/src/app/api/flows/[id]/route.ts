import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
