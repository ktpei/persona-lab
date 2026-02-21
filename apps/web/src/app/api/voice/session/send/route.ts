import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getSession } from "@/lib/voice/session-store";
import { streamTTS, getVoiceIdForPersona } from "@/lib/voice/elevenlabs";
import { VOICE_PERSONA_SYSTEM_PROMPT } from "@/lib/voice/persona-prompt";
import { buildPersonaContext } from "@persona-lab/shared";
import type { PersonaData } from "@persona-lab/shared";
import { DEFAULT_MODEL } from "@persona-lab/shared";

let openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!openai) {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error("OPENROUTER_API_KEY is not set");
    openai = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: key,
    });
  }
  return openai;
}

function sseEvent(event: string, data: string): string {
  return `event: ${event}\ndata: ${data}\n\n`;
}

/**
 * POST /api/voice/session/send
 * Body: { sessionId, transcript }
 * Runs persona LLM then TTS; pushes agent_text and agent_audio SSE events to the session stream.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { sessionId: string; transcript: string };
    const { sessionId, transcript } = body;
    if (!sessionId || typeof transcript !== "string" || !transcript.trim()) {
      return NextResponse.json(
        { error: "sessionId and transcript required" },
        { status: 400 }
      );
    }

    const session = getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const personaData: PersonaData = {
      name: session.personaName,
      knobs: null,
      traits: session.personaTraits,
      ageGroup: null,
      gender: null,
    };
    const personaContext = buildPersonaContext(personaData);
    const flowSummary = session.flowContext.stepSummaries?.length
      ? session.flowContext.stepSummaries
          .map((s, i) => `Step ${i + 1}: ${s}`)
          .join("\n")
      : `Flow "${session.flowContext.name}" has ${session.flowContext.frameCount} screens.`;

    const systemPrompt = `${personaContext}

## Visible UX flow
${flowSummary}

## Voice behavior (mandatory)
${VOICE_PERSONA_SYSTEM_PROMPT}

You are speaking aloud as "${session.personaName}". Keep each reply under ~20 seconds of speech. Be concise and analytical.`;

    const messages: Array<{ role: "user" | "assistant" | "system"; content: string }> = [
      { role: "system", content: systemPrompt },
      ...session.conversationTurns.flatMap((t) => [
        { role: "user" as const, content: t.user },
        { role: "assistant" as const, content: t.agent },
      ]),
      { role: "user", content: transcript },
    ];

    session.streamQueue.push(sseEvent("status", JSON.stringify({ status: "thinking" })));

    const openai = getOpenAI();
    const stream = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      stream: true,
      messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
      temperature: 0.5,
      max_tokens: 300,
    });

    let fullText = "";
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        fullText += delta;
        session.streamQueue.push(
          sseEvent("agent_text", JSON.stringify({ delta }))
        );
      }
    }

    session.conversationTurns.push({ user: transcript, agent: fullText });

    if (!fullText.trim()) {
      session.streamQueue.push(sseEvent("done", "{}"));
      return NextResponse.json({ ok: true });
    }

    session.streamQueue.push(sseEvent("status", JSON.stringify({ status: "speaking" })));

    const voiceId = getVoiceIdForPersona(session.personaTraits as Record<string, number>);
    try {
      // Buffer full TTS response; small MP3 chunks are not valid standalone and cause glitchy playback / NotSupportedError
      const chunks: Uint8Array[] = [];
      for await (const audioChunk of streamTTS({
        text: fullText,
        voiceId,
        optimizeStreamingLatency: 2,
      })) {
        chunks.push(audioChunk);
      }
      if (chunks.length > 0) {
        const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
        const combined = new Uint8Array(totalLength);
        let offset = 0;
        for (const c of chunks) {
          combined.set(c, offset);
          offset += c.length;
        }
        const b64 = Buffer.from(combined).toString("base64");
        session.streamQueue.push(sseEvent("agent_audio", JSON.stringify({ base64: b64 })));
      }
    } catch (ttsErr) {
      console.error("[voice/session/send] TTS failed", ttsErr);
      session.streamQueue.push(
        sseEvent("error", JSON.stringify({ message: "TTS failed; text-only fallback.", text: fullText }))
      );
    }

    session.streamQueue.push(sseEvent("done", "{}"));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[voice/session/send]", err);
    return NextResponse.json(
      { error: "Failed to process voice message" },
      { status: 500 }
    );
  }
}
