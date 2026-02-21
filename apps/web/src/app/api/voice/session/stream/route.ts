import { NextRequest } from "next/server";
import { getSession, destroySession } from "@/lib/voice/session-store";

/**
 * GET /api/voice/session/stream?sessionId=...
 * Returns an SSE stream. Client must connect here before sending transcripts.
 * Session is destroyed when the client disconnects (connection close).
 */
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return new Response("sessionId required", { status: 400 });
  }

  const session = getSession(sessionId);
  if (!session) {
    return new Response("Session not found or expired", { status: 404 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        while (!session.streamQueue.closed) {
          const chunk = await session.streamQueue.getNext();
          if (chunk === null) break;
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (e) {
        console.error("[voice/session/stream]", e);
      } finally {
        destroySession(sessionId);
        controller.close();
      }
    },
    cancel() {
      destroySession(sessionId);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
