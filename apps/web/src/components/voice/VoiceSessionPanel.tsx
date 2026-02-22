"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import ProjectVoiceSession from "./ProjectVoiceSession";

interface VoiceSessionPanelProps {
  personas: { id: string; name: string }[];
  flows: { id: string; name: string; _count?: { frames: number } }[];
  onClose: () => void;
}

export function VoiceSessionPanel({ personas, flows, onClose }: VoiceSessionPanelProps) {
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  if (started && selectedPersonaId) {
    return (
      <ProjectVoiceSession
        projectId=""
        personaId={selectedPersonaId}
        onClose={onClose}
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Select a persona to start a voice conversation.
      </p>
      <div className="space-y-1.5 max-h-60 overflow-y-auto">
        {personas.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelectedPersonaId(p.id)}
            className={`flex w-full items-center justify-between rounded border px-3.5 py-2.5 text-left text-[15px] transition-colors ${
              selectedPersonaId === p.id
                ? "border-primary bg-primary/5 text-primary"
                : "border-border/60 text-foreground hover:border-border"
            }`}
          >
            <span>{p.name}</span>
            {selectedPersonaId === p.id && <Check className="h-4 w-4 text-primary" />}
          </button>
        ))}
        {personas.length === 0 && (
          <p className="text-sm text-muted-foreground py-2">No personas available.</p>
        )}
      </div>
      <Button
        onClick={() => setStarted(true)}
        disabled={!selectedPersonaId}
        className="w-full"
      >
        Start Voice Session
      </Button>
    </div>
  );
}
