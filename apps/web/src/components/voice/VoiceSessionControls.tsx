"use client";

import { Button } from "@/components/ui/button";
import { Mic, Square } from "lucide-react";
import type { VoiceSessionStatus } from "@/hooks/useVoiceSession";

interface VoiceSessionControlsProps {
  status: VoiceSessionStatus;
  micListening: boolean;
  onMicToggle: () => void;
  onEndSession: () => void;
  disabled?: boolean;
}

export function VoiceSessionControls({
  status,
  micListening,
  onMicToggle,
  onEndSession,
  disabled,
}: VoiceSessionControlsProps) {
  const isActive = status === "listening" || status === "thinking" || status === "speaking";
  const canUseMic = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onEndSession}
        disabled={disabled}
        className="gap-1.5"
      >
        <Square className="h-3.5 w-3.5" />
        End Session
      </Button>
      {canUseMic && (
        <Button
          type="button"
          variant={micListening ? "default" : "outline"}
          size="sm"
          onClick={onMicToggle}
          disabled={disabled || status === "thinking" || status === "speaking"}
          className="gap-1.5"
        >
          <Mic className="h-3.5 w-3.5" />
          {micListening ? "Listening…" : status === "thinking" ? "Thinking…" : status === "speaking" ? "Speaking…" : "Mic"}
        </Button>
      )}
    </div>
  );
}
