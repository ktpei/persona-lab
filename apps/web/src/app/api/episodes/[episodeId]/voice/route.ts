import { NextRequest } from "next/server";
import { buildEpisodeContext } from "@/lib/build-episode-context";
import { selectVoiceForPersona } from "@/lib/voice/elevenlabs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ episodeId: string }> }
) {
  const { episodeId } = await params;

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;

  if (!apiKey) {
    return new Response(JSON.stringify({ error: "ELEVENLABS_API_KEY is not set" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!agentId) {
    return new Response(JSON.stringify({ error: "ELEVENLABS_AGENT_ID is not set" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let ctx;
  try {
    ctx = await buildEpisodeContext(episodeId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("not found") ? 404 : 400;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { systemPrompt, persona } = ctx;
  const voiceId = selectVoiceForPersona(
    persona.gender,
    persona.ageGroup,
    persona.traits as Record<string, number> | null,
  );

  const firstMessage = `Hey, I'm ${persona.name}. I just went through your flow — ask me anything about my experience.`;

  try {
    // Get signed URL from ElevenLabs Conversational AI
    const signedUrlRes = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
      {
        method: "GET",
        headers: {
          "xi-api-key": apiKey,
        },
      }
    );

    if (!signedUrlRes.ok) {
      const errorText = await signedUrlRes.text();
      console.error("ElevenLabs signed URL error:", signedUrlRes.status, errorText);
      return new Response(
        JSON.stringify({ error: "Failed to create voice session" }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const { signed_url: signedUrl } = await signedUrlRes.json();

    return new Response(
      JSON.stringify({
        signedUrl,
        systemPrompt,
        voiceId,
        firstMessage,
        personaName: persona.name,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Voice session error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to initialize voice session" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
