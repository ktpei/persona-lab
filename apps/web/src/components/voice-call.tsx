"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useConversation } from "@elevenlabs/react";
import { X, Phone, PhoneOff, Mic } from "lucide-react";

interface TranscriptEntry {
  source: "user" | "ai";
  message: string;
}

interface VoiceCallProps {
  episodeId: string;
  personaName: string;
  onClose: () => void;
}

type CallStatus = "initializing" | "connecting" | "connected" | "ended" | "error";

export function VoiceCall({ episodeId, personaName, onClose }: VoiceCallProps) {
  const [callStatus, setCallStatus] = useState<CallStatus>("initializing");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [micVolume, setMicVolume] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionStarted = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const conversation = useConversation({
    onConnect: () => {
      console.log("[VoiceCall] Connected");
      setCallStatus("connected");
    },
    onDisconnect: (details) => {
      console.log("[VoiceCall] Disconnected reason:", details?.reason);
      console.log("[VoiceCall] Disconnected full:", JSON.stringify(details, null, 2));
      if (details && "message" in details) {
        console.log("[VoiceCall] Disconnect message:", details.message);
      }
      if (details && "closeCode" in details) {
        console.log("[VoiceCall] Close code:", details.closeCode, "Close reason:", details.closeReason);
      }
      setCallStatus("ended");
    },
    onMessage: (msg) => {
      console.log("[VoiceCall] Message:", msg);
      setTranscript((prev) => [...prev, { source: msg.source, message: msg.message }]);
    },
    onError: (message, context) => {
      console.error("[VoiceCall] Error:", message, context);
      setErrorMessage(message);
      setCallStatus("error");
    },
    onModeChange: (prop) => {
      console.log("[VoiceCall] Mode change:", prop.mode);
    },
    onStatusChange: (prop) => {
      console.log("[VoiceCall] Status change:", prop.status);
    },
  });

  // Keep a stable ref to conversation so the init effect doesn't depend on it
  const conversationRef = useRef(conversation);
  conversationRef.current = conversation;

  // Mic volume analyser — reads RMS from microphone input at ~30fps
  const startVolumeAnalysis = useCallback((stream: MediaStream) => {
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.5;
    source.connect(analyser);

    audioContextRef.current = ctx;
    analyserRef.current = analyser;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    function tick() {
      analyser.getByteFrequencyData(dataArray);
      // Compute RMS-ish volume (0-1)
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length / 255;
      // Apply a curve so quiet speech still shows movement
      const vol = Math.min(1, avg * 3);
      setMicVolume(vol);
      animFrameRef.current = requestAnimationFrame(tick);
    }

    tick();
  }, []);

  const stopVolumeAnalysis = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    audioContextRef.current = null;
    analyserRef.current = null;
    mediaStreamRef.current = null;
  }, []);

  // Scroll transcript to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  // Start session on mount
  useEffect(() => {
    if (sessionStarted.current) return;
    sessionStarted.current = true;

    async function initSession() {
      try {
        // Request mic permission and keep the stream for volume analysis
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        startVolumeAnalysis(stream);

        // Get signed URL + context from server
        const res = await fetch(`/api/episodes/${episodeId}/voice`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to initialize voice session");
        }

        const { signedUrl, systemPrompt, voiceId, firstMessage } = await res.json();

        console.log("[VoiceCall] Got signed URL, starting session...");
        console.log("[VoiceCall] System prompt length:", systemPrompt.length);
        console.log("[VoiceCall] Voice ID:", voiceId);
        console.log("[VoiceCall] First message:", firstMessage);

        setCallStatus("connecting");

        // dynamicVariables inject persona context into the agent's
        // {{system_prompt}} / {{first_message}} template placeholders.
        // tts.voiceId override sets a bio-appropriate voice per persona
        // (requires voice_id override enabled in ElevenLabs Security tab).
        const conversationId = await conversationRef.current.startSession({
          signedUrl,
          dynamicVariables: {
            system_prompt: systemPrompt,
            first_message: firstMessage,
          },
          overrides: {
            tts: { voiceId },
          },
        });

        console.log("[VoiceCall] Session started, conversation ID:", conversationId);
      } catch (err) {
        console.error("[VoiceCall] Failed to start voice session:", err);
        setErrorMessage(err instanceof Error ? err.message : "Failed to connect");
        setCallStatus("error");
      }
    }

    initSession();
  }, [episodeId, startVolumeAnalysis]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => stopVolumeAnalysis();
  }, [stopVolumeAnalysis]);

  const handleEndCall = useCallback(async () => {
    try {
      await conversationRef.current.endSession();
    } catch {
      // Already disconnected
    }
    stopVolumeAnalysis();
    setCallStatus("ended");
  }, [stopVolumeAnalysis]);

  const handleClose = useCallback(() => {
    if (callStatus === "connected" || callStatus === "connecting") {
      conversationRef.current.endSession().catch(() => {});
    }
    stopVolumeAnalysis();
    onClose();
  }, [callStatus, onClose, stopVolumeAnalysis]);

  // Derive circle scale from mic volume when connected & not agent-speaking
  const isListening = callStatus === "connected" && !conversation.isSpeaking;
  const circleScale = isListening ? 1 + micVolume * 0.5 : 1;
  // Outer ring scale — bigger swing for visual punch
  const ringScale = isListening ? 1 + micVolume * 0.8 : 1;
  const ringOpacity = isListening ? 0.08 + micVolume * 0.25 : 0;

  return (
    <div className="fixed top-0 right-0 z-50 h-full w-[420px] flex flex-col border-l border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Phone className="w-3.5 h-3.5 text-primary" />
          <span className="text-[15px] font-medium text-foreground">Call with {personaName}</span>
        </div>
        <button
          onClick={handleClose}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Call status area */}
      <div className="flex flex-col items-center justify-center py-8 shrink-0 border-b border-border/40">
        {/* Voice-reactive indicator */}
        <div className="relative flex items-center justify-center" style={{ width: 96, height: 96 }}>
          {/* Outer reactive ring — scales with mic volume */}
          {callStatus === "connected" && (
            <div
              className={`absolute rounded-full ${
                conversation.isSpeaking ? "bg-primary" : "bg-emerald-400"
              }`}
              style={{
                width: 80,
                height: 80,
                left: "50%",
                top: "50%",
                transform: `translate(-50%, -50%) scale(${conversation.isSpeaking ? 1.15 : ringScale})`,
                opacity: conversation.isSpeaking ? 0.15 : ringOpacity,
                transition: conversation.isSpeaking
                  ? "transform 0.6s ease, opacity 0.6s ease"
                  : "transform 0.08s ease-out, opacity 0.08s ease-out",
              }}
            />
          )}

          {/* Pulse ring for agent speaking */}
          {callStatus === "connected" && conversation.isSpeaking && (
            <div
              className="absolute rounded-full bg-primary"
              style={{
                width: 80,
                height: 80,
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                animation: "ping 2s cubic-bezier(0, 0, 0.2, 1) infinite",
                opacity: 0.15,
              }}
            />
          )}

          {/* Connecting pulse */}
          {(callStatus === "connecting" || callStatus === "initializing") && (
            <div
              className="absolute rounded-full bg-muted-foreground"
              style={{
                width: 80,
                height: 80,
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                animation: "ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite",
                opacity: 0.12,
              }}
            />
          )}

          {/* Core circle */}
          <div
            className={`rounded-full flex items-center justify-center ${
              callStatus === "connected"
                ? conversation.isSpeaking
                  ? "bg-primary/20"
                  : "bg-emerald-400/15"
                : callStatus === "connecting" || callStatus === "initializing"
                  ? "bg-muted"
                  : callStatus === "error"
                    ? "bg-red-400/15"
                    : "bg-muted"
            }`}
            style={{
              width: 80,
              height: 80,
              transform: `scale(${circleScale})`,
              transition: isListening
                ? "transform 0.08s ease-out, background-color 0.3s"
                : "transform 0.3s ease, background-color 0.3s",
            }}
          >
            {callStatus === "connected" ? (
              conversation.isSpeaking ? (
                <Phone className="w-8 h-8 text-primary relative z-10" />
              ) : (
                <Mic className="w-8 h-8 text-emerald-400 relative z-10" />
              )
            ) : callStatus === "error" ? (
              <PhoneOff className="w-8 h-8 text-red-400" />
            ) : callStatus === "ended" ? (
              <PhoneOff className="w-8 h-8 text-muted-foreground" />
            ) : (
              <Phone className="w-8 h-8 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Status text */}
        <p className="text-sm text-muted-foreground mt-3">
          {callStatus === "initializing" && "Initializing..."}
          {callStatus === "connecting" && "Connecting..."}
          {callStatus === "connected" &&
            (conversation.isSpeaking ? `${personaName} is speaking...` : "Listening...")}
          {callStatus === "ended" && "Call ended"}
          {callStatus === "error" && (errorMessage || "Connection failed")}
        </p>

        {/* Call controls */}
        {callStatus === "connected" && (
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={handleEndCall}
              className="px-4 py-2 rounded bg-red-500/15 text-red-400 hover:bg-red-500/25 text-xs font-medium transition-colors"
            >
              End Call
            </button>
          </div>
        )}

        {/* Retry / close for error / ended */}
        {(callStatus === "error" || callStatus === "ended") && (
          <button
            onClick={handleClose}
            className="mt-4 px-4 py-2 rounded bg-muted text-foreground hover:bg-muted/80 text-xs font-medium transition-colors"
          >
            Close
          </button>
        )}
      </div>

      {/* Live transcript */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="px-4 py-2 border-b border-border/40">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">
            Transcript
          </span>
        </div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {transcript.length === 0 && callStatus !== "error" && (
            <p className="text-sm text-muted-foreground text-center mt-4">
              {callStatus === "connected"
                ? "Start speaking..."
                : "Transcript will appear here once connected."}
            </p>
          )}
          {transcript.map((entry, i) => (
            <div
              key={i}
              className={`flex ${entry.source === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] px-3 py-2 rounded text-[15px] ${
                  entry.source === "user"
                    ? "bg-primary/15 text-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                <span className="text-[11px] text-muted-foreground block mb-0.5">
                  {entry.source === "user" ? "You" : personaName}
                </span>
                {entry.message}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
