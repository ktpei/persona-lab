"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useVoiceSession } from "@/hooks/useVoiceSession";
import { VoiceSessionControls } from "./VoiceSessionControls";

interface Flow {
  id: string;
  name: string;
  _count?: { frames: number };
}

interface Persona {
  id: string;
  name: string;
}

interface VoiceSessionPanelProps {
  personas: Persona[];
  flows: Flow[];
  onClose?: () => void;
}

export function VoiceSessionPanel({
  personas,
  flows,
  onClose,
}: VoiceSessionPanelProps) {
  const [personaId, setPersonaId] = useState("");
  const [flowId, setFlowId] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [micListening, setMicListening] = useState(false);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  const {
    status,
    agentText,
    error,
    startSession,
    endSession,
    sendTranscript,
    personaName,
    activeTraits,
  } = useVoiceSession({
    onError: () => {},
  });

  const handleEndSession = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    setMicListening(false);
    endSession();
    onClose?.();
  }, [endSession, onClose]);

  const handleMicToggle = useCallback(() => {
    if (micListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
        recognitionRef.current = null;
      }
      setMicListening(false);
      return;
    }

    const Win = typeof window !== "undefined" ? window : null;
    type WinWithSR = { SpeechRecognition?: new () => SRInstance; webkitSpeechRecognition?: new () => SRInstance };
    type SRInstance = { start(): void; stop(): void; continuous: boolean; interimResults: boolean; lang: string; onresult: ((e: { results: { length: number; isFinal: boolean; [i: number]: { transcript?: string } }[] }) => void) | null; onerror: (() => void) | null };
    const SR = Win && ("SpeechRecognition" in Win || "webkitSpeechRecognition" in Win)
      ? (Win as unknown as WinWithSR).SpeechRecognition ?? (Win as unknown as WinWithSR).webkitSpeechRecognition ?? null
      : null;
    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (e: { results: { length: number; isFinal: boolean; [i: number]: { transcript?: string } }[] }) => {
      const results = e.results;
      const result = results[results.length - 1];
      if (result?.isFinal && result[0]?.transcript?.trim()) {
        sendTranscript(result[0].transcript.trim());
      }
    };
    recognition.onerror = () => setMicListening(false);
    recognition.start();
    recognitionRef.current = recognition;
    setMicListening(true);
  }, [micListening, sendTranscript]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, []);

  const handleSend = useCallback(() => {
    const t = inputValue.trim();
    if (!t) return;
    setInputValue("");
    sendTranscript(t);
  }, [inputValue, sendTranscript]);

  const isActive = status !== "idle" && status !== "error";
  const canStart = personaId && flowId && status === "idle";

  return (
    <div
      className="rounded border border-border bg-card p-4 text-[15px]"
      style={{
        borderStyle: isActive ? "solid" : "dashed",
        borderColor: isActive ? "var(--color-primary)" : undefined,
      }}
    >
      {status === "idle" && (
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label>Persona</Label>
            <Select value={personaId} onValueChange={setPersonaId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select persona" />
              </SelectTrigger>
              <SelectContent>
                {personas.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Flow</Label>
            <Select value={flowId} onValueChange={setFlowId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select flow" />
              </SelectTrigger>
              <SelectContent>
                {flows.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                    {f._count?.frames != null ? ` (${f._count.frames} screens)` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => startSession({ personaId, flowId })}
              disabled={!canStart}
              className="gap-1.5"
            >
              Start Voice Session
            </Button>
            {onClose && (
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      )}

      {isActive && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              {personaName && (
                <span className="font-medium text-foreground">{personaName}</span>
              )}
              {activeTraits.length > 0 && (
                <span className="ml-2 text-muted-foreground text-xs">
                  ({activeTraits.join(", ")})
                </span>
              )}
            </div>
            <VoiceSessionControls
              status={status}
              micListening={micListening}
              onMicToggle={handleMicToggle}
              onEndSession={handleEndSession}
            />
          </div>

          {error && (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          )}

          <div className="min-h-[120px] rounded border border-border bg-muted/30 p-3 font-mono text-sm">
            <p className="text-muted-foreground">Transcript (explainability)</p>
            {agentText && (
              <p className="mt-2 whitespace-pre-wrap text-foreground">
                {agentText || "—"}
              </p>
            )}
            {!agentText && status === "listening" && (
              <p className="mt-2 text-muted-foreground">Listening…</p>
            )}
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Type or use mic…"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              disabled={status === "thinking" || status === "speaking"}
            />
            <Button
              onClick={handleSend}
              disabled={!inputValue.trim() || status === "thinking" || status === "speaking"}
            >
              Send
            </Button>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="space-y-2">
          <p className="text-destructive text-sm">{error}</p>
          <Button variant="outline" onClick={() => endSession()}>
            Try again
          </Button>
          {onClose && (
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
