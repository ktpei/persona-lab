import { NextRequest, NextResponse } from "next/server";
import { destroySession } from "@/lib/voice/session-store";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { sessionId: string };
  if (body.sessionId) {
    destroySession(body.sessionId);
  }
  return NextResponse.json({ ok: true });
}
