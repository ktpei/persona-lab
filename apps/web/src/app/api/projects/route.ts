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

  const devMode = process.env.DEV_AUTH === "true";

  try {
    const project = await prisma.$transaction(async (tx) => {
      if (!devMode) {
        const projectCount = await tx.project.count({
          where: { userId: session.user.id },
        });
        if (projectCount >= 1) {
          throw new Error("LIMIT_EXCEEDED");
        }
      }
      return tx.project.create({
        data: { ...input, userId: session.user.id },
      });
    });
    return NextResponse.json(project, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "LIMIT_EXCEEDED") {
      return NextResponse.json(
        { error: "Demo accounts are limited to 1 project." },
        { status: 403 }
      );
    }
    throw err;
  }
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
