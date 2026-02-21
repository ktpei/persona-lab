/**
 * In-memory voice session store. Ephemeral; destroyed on session end or disconnect.
 * No database writes. No persistence.
 */

export interface OCEANProfile {
  patience?: number;
  exploration?: number;
  frustrationSensitivity?: number;
  forgiveness?: number;
  helpSeeking?: number;
  accessibilityNeeds?: string[];
}

export interface FlowSummary {
  id: string;
  name: string;
  frameCount: number;
  stepSummaries?: string[];
}

/** Queue for SSE chunks so GET stream and POST send can share the same session. */
export interface StreamQueue {
  push(chunk: string): void;
  close(): void;
  closed: boolean;
  getNext(): Promise<string | null>;
}

function createStreamQueue(): StreamQueue {
  const queue: string[] = [];
  let resolveWait: (() => void) | null = null;
  let closed = false;

  return {
    get closed() {
      return closed;
    },
    push(chunk: string) {
      if (closed) return;
      queue.push(chunk);
      if (resolveWait) {
        const r = resolveWait;
        resolveWait = null;
        r();
      }
    },
    close() {
      closed = true;
      if (resolveWait) {
        const r = resolveWait;
        resolveWait = null;
        r();
      }
    },
    async getNext(): Promise<string | null> {
      if (queue.length > 0) return queue.shift() ?? null;
      if (closed) return null;
      await new Promise<void>((r) => {
        resolveWait = r;
      });
      if (closed && queue.length === 0) return null;
      return queue.shift() ?? null;
    },
  };
}

export interface VoiceSessionData {
  sessionId: string;
  personaId: string;
  personaName: string;
  personaTraits: OCEANProfile;
  flowContext: FlowSummary;
  conversationTurns: Array<{ user: string; agent: string }>;
  streamQueue: StreamQueue;
}

// Use global so the Map survives Next.js HMR / module re-execution in dev
const globalForSessions = globalThis as unknown as { __voiceSessions?: Map<string, VoiceSessionData> };
const sessions = globalForSessions.__voiceSessions ?? new Map<string, VoiceSessionData>();
globalForSessions.__voiceSessions = sessions;

export function createSession(
  sessionId: string,
  personaId: string,
  personaName: string,
  personaTraits: OCEANProfile,
  flowContext: FlowSummary
): VoiceSessionData {
  const session: VoiceSessionData = {
    sessionId,
    personaId,
    personaName,
    personaTraits,
    flowContext,
    conversationTurns: [],
    streamQueue: createStreamQueue(),
  };
  sessions.set(sessionId, session);
  return session;
}

export function getSession(sessionId: string): VoiceSessionData | undefined {
  return sessions.get(sessionId);
}

export function destroySession(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.streamQueue.close();
  }
  sessions.delete(sessionId);
}
