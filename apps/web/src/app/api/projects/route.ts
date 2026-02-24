import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { z } from "zod";

const CreateProjectInput = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const input = CreateProjectInput.parse(body);

  const project = await prisma.project.create({
    data: { ...input, userId: session.user.id },
  });

  return NextResponse.json(project, { status: 201 });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projects = await prisma.project.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { flows: true, personas: true } },
      flows: {
        select: { _count: { select: { runs: true } } },
      },
    },
  });

  const result = projects.map(({ flows, ...project }) => ({
    ...project,
    _count: {
      ...project._count,
      runs: flows.reduce((sum, f) => sum + f._count.runs, 0),
    },
  }));

  return NextResponse.json(result);
}
