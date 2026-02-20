import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { storage } from "@/lib/storage";
import crypto from "node:crypto";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: flowId } = await params;

  const flow = await prisma.flow.findUnique({ where: { id: flowId } });
  if (!flow) {
    return NextResponse.json({ error: "Flow not found" }, { status: 404 });
  }

  try {
    const formData = await req.formData();
    const files = formData.getAll("frames") as File[];

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No files uploaded" },
        { status: 400 }
      );
    }

    const existingCount = await prisma.frame.count({ where: { flowId } });

    const frames = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const buffer = Buffer.from(await file.arrayBuffer());
      const ext = file.name.split(".").pop() || "png";
      const key = `frames/${flowId}/${crypto.randomUUID()}.${ext}`;

      await storage.save(key, buffer);

      const frame = await prisma.frame.create({
        data: {
          flowId,
          stepIndex: existingCount + i,
          imagePath: key,
        },
      });
      frames.push(frame);
    }

    return NextResponse.json(frames, { status: 201 });
  } catch (err) {
    console.error("Frame upload error:", err);
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: flowId } = await params;
  const { frameId } = await req.json();

  const frame = await prisma.frame.findUnique({ where: { id: frameId } });
  if (!frame || frame.flowId !== flowId) {
    return NextResponse.json({ error: "Frame not found" }, { status: 404 });
  }

  // Delete image file from storage
  await storage.delete(frame.imagePath);

  // Delete frame record
  await prisma.frame.delete({ where: { id: frameId } });

  // Re-index remaining frames so stepIndex stays sequential
  const remaining = await prisma.frame.findMany({
    where: { flowId },
    orderBy: { stepIndex: "asc" },
  });

  for (let i = 0; i < remaining.length; i++) {
    if (remaining[i].stepIndex !== i) {
      await prisma.frame.update({
        where: { id: remaining[i].id },
        data: { stepIndex: i },
      });
    }
  }

  return NextResponse.json({ ok: true });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: flowId } = await params;

  const frames = await prisma.frame.findMany({
    where: { flowId },
    orderBy: { stepIndex: "asc" },
  });

  return NextResponse.json(frames);
}
