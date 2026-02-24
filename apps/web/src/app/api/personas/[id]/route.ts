import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const persona = await prisma.persona.findUnique({ where: { id } });
  if (!persona) {
    return NextResponse.json({ error: "Persona not found" }, { status: 404 });
  }
  if (persona.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.persona.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
