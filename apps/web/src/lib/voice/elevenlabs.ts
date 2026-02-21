/**
 * ElevenLabs TTS integration for Voice Session Mode.
 * No direct client access to ElevenLabs; all usage server-side.
 */

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1";

/** Map persona trait profile to ElevenLabs voice_id. Config-driven; replace with your voice IDs. */
export const PERSONA_VOICE_MAP: Record<string, string> = {
  analytical: "pNInz6obpgDQGcFmaJgB", // Adam — neutral, calm
  anxious: "TxGEqnHWrfWFTfGW9XjX",     // Josh — measured, soft
  impulsive: "VR6AewLTigWG4xSOukaG",   // Arnold — direct, clear
};

const DEFAULT_VOICE_ID = PERSONA_VOICE_MAP.analytical;

/** Derive voice key from persona traits for voice selection. */
export function getVoiceIdForPersona(traits: Record<string, number> | null): string {
  if (!traits || typeof traits.frustrationSensitivity !== "number") {
    return DEFAULT_VOICE_ID;
  }
  if (traits.frustrationSensitivity > 0.65) return PERSONA_VOICE_MAP.anxious;
  if (traits.patience !== undefined && traits.patience < 0.35) return PERSONA_VOICE_MAP.impulsive;
  return PERSONA_VOICE_MAP.analytical;
}

/**
 * Convert speech to text using ElevenLabs Speech-to-Text API
 */
export async function speechToText(audioBuffer: ArrayBuffer): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not set");
  }

  const url = `${ELEVENLABS_BASE}/speech-to-text`;
  
  // Create a blob from the audio buffer
  const blob = new Blob([audioBuffer], { type: 'audio/webm' });
  
  const formData = new FormData();
  formData.append('audio', blob);
  formData.append('model_id', 'whisper_large_v3');
  formData.append('language', 'eng');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs STT failed: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  
  if (!result.text) {
    throw new Error('No transcription returned from ElevenLabs');
  }

  return result.text;
}

export interface StreamTTSOptions {
  text: string;
  voiceId?: string;
  modelId?: string;
  outputFormat?: string;
  optimizeStreamingLatency?: number;
}

/**
 * Stream TTS audio from ElevenLabs. Yields chunks of binary audio.
 * Caller must handle ELEVENLABS_API_KEY missing and network errors.
 */
export async function* streamTTS(options: StreamTTSOptions): AsyncGenerator<Uint8Array, void, unknown> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not set");
  }

  const voiceId = options.voiceId ?? DEFAULT_VOICE_ID;
  const modelId = options.modelId ?? "eleven_multilingual_v2";
  const outputFormat = options.outputFormat ?? "mp3_22050_32";
  const latency = options.optimizeStreamingLatency ?? 2;

  const url = `${ELEVENLABS_BASE}/text-to-speech/${voiceId}/stream?output_format=${outputFormat}&optimize_streaming_latency=${latency}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify({
      text: options.text,
      model_id: modelId,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ElevenLabs TTS failed: ${res.status} ${errText}`);
  }

  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error("No response body from ElevenLabs");
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.length > 0) yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Non-streaming TTS for simple use cases
 */
export async function textToSpeech(text: string, voiceId?: string): Promise<ArrayBuffer> {
  const chunks: Uint8Array[] = [];
  
  for await (const chunk of streamTTS({ text, voiceId })) {
    chunks.push(chunk);
  }
  
  // Combine all chunks into a single ArrayBuffer
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  
  return result.buffer;
}
