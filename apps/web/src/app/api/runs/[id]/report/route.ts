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
      findings: { orderBy: { severity: "desc" } },
    },
  });

  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  if (run.status !== "COMPLETED") {
    return NextResponse.json(
      { error: "Run not completed", status: run.status },
      { status: 400 }
    );
  }

  return NextResponse.json({
    report: run.reportJson,
    findings: run.findings,
  });
}
