"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Save, Loader2, Users } from "lucide-react";

// Consistent persona colors for the focus group
const PERSONA_COLORS = [
  { dot: "bg-blue-400", name: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/20" },
  { dot: "bg-amber-400", name: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-400/20" },
  { dot: "bg-emerald-400", name: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20" },
  { dot: "bg-purple-400", name: "text-purple-400", bg: "bg-purple-400/10", border: "border-purple-400/20" },
  { dot: "bg-rose-400", name: "text-rose-400", bg: "bg-rose-400/10", border: "border-rose-400/20" },
  { dot: "bg-cyan-400", name: "text-cyan-400", bg: "bg-cyan-400/10", border: "border-cyan-400/20" },
  { dot: "bg-orange-400", name: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/20" },
  { dot: "bg-teal-400", name: "text-teal-400", bg: "bg-teal-400/10", border: "border-teal-400/20" },
  { dot: "bg-pink-400", name: "text-pink-400", bg: "bg-pink-400/10", border: "border-pink-400/20" },
  { dot: "bg-indigo-400", name: "text-indigo-400", bg: "bg-indigo-400/10", border: "border-indigo-400/20" },
];

interface Participant {
  personaId: string;
  name: string;
}

interface FocusGroupMessage {
  role: "user" | "persona";
  personaId?: string;
  personaName?: string;
  text: string;
}

interface FocusGroupTabProps {
  runId: string;
  participants: Participant[];
}

export function FocusGroupTab({ runId, participants }: FocusGroupTabProps) {
  const [messages, setMessages] = useState<FocusGroupMessage[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build personaId → color index map
  const colorMap = useRef(
    new Map(participants.map((p, i) => [p.personaId, i % PERSONA_COLORS.length]))
  ).current;

  // Also map by name for LLM responses that may not include exact personaId
  const nameToColor = useRef(
    new Map(participants.map((p, i) => [p.name.toLowerCase(), i % PERSONA_COLORS.length]))
  ).current;

  function getColor(personaId?: string, personaName?: string) {
    if (personaId && colorMap.has(personaId)) {
      return PERSONA_COLORS[colorMap.get(personaId)!];
    }
    if (personaName && nameToColor.has(personaName.toLowerCase())) {
      return PERSONA_COLORS[nameToColor.get(personaName.toLowerCase())!];
    }
    return PERSONA_COLORS[0];
  }

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function send() {
    const text = input.trim();
    if (!text || isProcessing) return;

    const userMsg: FocusGroupMessage = { role: "user", text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setIsProcessing(true);
    setSaved(false);

    try {
      // Build message history for the API — collapse persona responses into assistant-style messages
      const apiMessages: Array<{ role: "user" | "persona"; personaName?: string; text: string }> = [];
      let pendingPersonaTexts: string[] = [];

      for (const msg of updatedMessages) {
        if (msg.role === "user") {
          if (pendingPersonaTexts.length > 0) {
            apiMessages.push({ role: "persona", text: pendingPersonaTexts.join("\n") });
            pendingPersonaTexts = [];
          }
          apiMessages.push({ role: "user", text: msg.text });
        } else {
          pendingPersonaTexts.push(`${msg.personaName}: ${msg.text}`);
        }
      }
      if (pendingPersonaTexts.length > 0) {
        apiMessages.push({ role: "persona", text: pendingPersonaTexts.join("\n") });
      }

      const res = await fetch(`/api/runs/${runId}/focus-group`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!res.ok) throw new Error("Focus group request failed");

      const data = (await res.json()) as {
        responses: Array<{ personaId: string; name: string; text: string }>;
      };

      const newMessages: FocusGroupMessage[] = data.responses.map((r) => ({
        role: "persona" as const,
        personaId: r.personaId,
        personaName: r.name,
        text: r.text,
      }));

      setMessages((prev) => [...prev, ...newMessages]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "persona",
          personaName: "System",
          text: "Something went wrong. Please try again.",
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  async function saveTranscript() {
    if (messages.length === 0 || saving) return;
    setSaving(true);

    try {
      const res = await fetch(`/api/runs/${runId}/focus-group/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: messages }),
      });

      if (res.ok) {
        setSaved(true);
      }
    } catch {
      // Save failure — user can retry
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      {/* Participants header */}
      <div className="flex items-center justify-between pb-4 border-b border-border/40">
        <div className="flex items-center gap-2 flex-wrap">
          <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest shrink-0">
            Participants
          </span>
          <div className="flex items-center gap-3 ml-1">
            {participants.map((p) => {
              const color = getColor(p.personaId);
              return (
                <span
                  key={p.personaId}
                  className="inline-flex items-center gap-1.5 text-[13px] font-normal text-foreground"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${color.dot}`} />
                  {p.name}
                </span>
              );
            })}
          </div>
        </div>
        <button
          onClick={saveTranscript}
          disabled={messages.length === 0 || saving || saved}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border border-border/60 text-foreground hover:bg-muted/40 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {saving ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Save className="w-3 h-3" />
          )}
          {saved ? "Saved" : "Save"}
        </button>
      </div>

      {/* Transcript area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-4 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Users className="w-8 h-8 text-muted-foreground/30 mb-3" />
            <p className="text-[15px] text-muted-foreground">
              Start the focus group discussion
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Ask a question and {participants.length} personas will respond
            </p>
          </div>
        )}

        {messages.map((msg, i) => {
          if (msg.role === "user") {
            return (
              <div key={i} className="flex justify-end">
                <div className="max-w-[80%]">
                  <div className="text-[11px] text-muted-foreground mb-1 text-right">You</div>
                  <div className="px-3 py-2 rounded bg-primary/15 text-[15px] text-foreground whitespace-pre-wrap">
                    {msg.text}
                  </div>
                </div>
              </div>
            );
          }

          const color = getColor(msg.personaId, msg.personaName);

          return (
            <div key={i} className="flex justify-start">
              <div className="max-w-[80%]">
                <div className={`text-[11px] font-medium mb-1 ${color.name}`}>
                  {msg.personaName}
                </div>
                <div
                  className={`px-3 py-2 rounded border text-[15px] text-foreground whitespace-pre-wrap ${color.bg} ${color.border}`}
                >
                  {msg.text}
                </div>
              </div>
            </div>
          );
        })}

        {isProcessing && (
          <div className="flex justify-start">
            <div className="px-3 py-2 rounded bg-muted">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-border/40 pt-3 shrink-0">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a question..."
            disabled={isProcessing}
            className="flex-1 bg-muted border border-border rounded px-3 py-2 text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 disabled:opacity-50"
          />
          <button
            onClick={send}
            disabled={!input.trim() || isProcessing}
            className="p-2 rounded bg-primary/15 text-primary hover:bg-primary/25 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
