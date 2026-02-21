"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export type VoiceSessionStatus = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "error";

export interface UseVoiceSessionOptions {
  onError?: (message: string) => void;
}

export interface UseVoiceSessionReturn {
  status: VoiceSessionStatus;
  transcript: string;
  liveTranscript: string;
  agentText: string;
  error: string | null;
  startSession: (params: { personaId: string; flowId: string }) => Promise<void>;
  endSession: () => void;
  sendTranscript: (text: string) => Promise<void>;
  setTranscript: (text: string) => void;
  personaName: string | null;
  activeTraits: string[];
}

export function useVoiceSession(options: UseVoiceSessionOptions = {}): UseVoiceSessionReturn {
  const [status, setStatus] = useState<VoiceSessionStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [agentText, setAgentText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [personaName, setPersonaName] = useState<string | null>(null);
  const [activeTraits, setActiveTraits] = useState<string[]>([]);

  const sessionIdRef = useRef<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);

  const { onError } = options;

  const playAudioChunk = useCallback((base64: string) => {
    if (!base64 || base64.length < 100) return; // skip empty or invalid fragments
    audioQueueRef.current.push(base64);
    const playNext = () => {
      if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
      isPlayingRef.current = true;
      const b64 = audioQueueRef.current.shift();
      if (!b64) {
        isPlayingRef.current = false;
        return;
      }
      try {
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: "audio/mpeg" });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => {
          URL.revokeObjectURL(url);
          isPlayingRef.current = false;
          playNext();
        };
        audio.onerror = (e) => {
          URL.revokeObjectURL(url);
          isPlayingRef.current = false;
          playNext();
        };
        audio.play().catch(() => {
          URL.revokeObjectURL(url);
          isPlayingRef.current = false;
          playNext();
        });
      } catch {
        isPlayingRef.current = false;
        playNext();
      }
    };
    playNext();
  }, []);

  const endSession = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (sessionIdRef.current) {
      fetch("/api/voice/session/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionIdRef.current }),
      }).catch(() => {});
      sessionIdRef.current = null;
    }
    setStatus("idle");
    setPersonaName(null);
    setActiveTraits([]);
    setError(null);
  }, []);

  const startSession = useCallback(
    async (params: { personaId: string; flowId: string }) => {
      setError(null);
      setStatus("connecting");
      setTranscript("");
      setLiveTranscript("");
      setAgentText("");
      try {
        const res = await fetch("/api/voice/session/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to start session");
        }
        const data = (await res.json()) as {
          sessionId: string;
          streamUrl: string;
          personaName?: string;
          flowName?: string;
        };
        sessionIdRef.current = data.sessionId;
        setPersonaName(data.personaName ?? null);

        const es = new EventSource(data.streamUrl);
        eventSourceRef.current = es;

        es.addEventListener("status", (e) => {
          try {
            const { status: s } = JSON.parse((e as MessageEvent).data) as { status: string };
            if (s === "thinking") setStatus("thinking");
            if (s === "speaking") setStatus("speaking");
          } catch {}
        });

        es.addEventListener("agent_text", (e) => {
          try {
            const { delta } = JSON.parse((e as MessageEvent).data) as { delta: string };
            setAgentText((prev) => prev + (delta ?? ""));
          } catch {}
        });

        es.addEventListener("agent_audio", (e) => {
          try {
            const { base64 } = JSON.parse((e as MessageEvent).data) as { base64: string };
            if (base64) playAudioChunk(base64);
          } catch {}
        });

        es.addEventListener("done", () => {
          setStatus("listening");
        });

        es.addEventListener("error", (e) => {
          const msg = (e as MessageEvent).data ?? "Stream error";
          setError(String(msg));
          onError?.(String(msg));
        });

        es.onerror = () => {
          if (status !== "idle") {
            setError("Connection lost");
            endSession();
          }
        };

        setStatus("listening");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to start";
        setError(message);
        setStatus("error");
        onError?.(message);
      }
    },
    [endSession, onError, playAudioChunk, status]
  );

  const sendTranscript = useCallback(
    async (text: string) => {
      const id = sessionIdRef.current;
      if (!id || !text.trim()) return;
      setAgentText("");
      setStatus("thinking");
      try {
        const res = await fetch("/api/voice/session/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: id, transcript: text.trim() }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to send");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Send failed";
        setError(message);
        setStatus("error");
      }
    },
    []
  );

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
      if (sessionIdRef.current) {
        fetch("/api/voice/session/end", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sessionIdRef.current }),
        }).catch(() => {});
      }
    };
  }, []);

  return {
    status,
    transcript,
    liveTranscript,
    agentText,
    error,
    startSession,
    endSession,
    sendTranscript,
    setTranscript,
    personaName,
    activeTraits,
  };
}
