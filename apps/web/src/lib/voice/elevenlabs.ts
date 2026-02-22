/**
 * ElevenLabs TTS integration for Voice Session Mode.
 * No direct client access to ElevenLabs; all usage server-side.
 */

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1";

// ── Voice library ───────────────────────────────────────────────────────
// All 21 voices from the ElevenLabs account, organized by gender & age.
//
// Male — young
const V_CHARLIE = "IKne3meq5aSn9XLyUdCD"; // deep, confident, energetic (Australian)
const V_LIAM    = "TX3LPaxmHKxFdv7VOQHJ"; // energetic social-media creator
const V_WILL    = "bIHbv24MWmeRgasZH58o"; // relaxed optimist
// Male — middle-aged
const V_ADAM    = "pNInz6obpgDQGcFmaJgB"; // dominant, firm
const V_BRIAN   = "nPczCjzI2devNBz1zQrb"; // deep, resonant, comforting
const V_CHRIS   = "iP95p4xoKVk53GoZ742B"; // charming, down-to-earth
const V_DANIEL  = "onwK4e9ZLuTAKqWW03F9"; // steady broadcaster (British)
const V_ERIC    = "cjVigY5qzO86Huf0OWal"; // smooth, trustworthy
const V_ROGER   = "CwhRBWXzGAHq8TQ4Fs17"; // laid-back, casual
// Male — old
const V_BILL    = "pqHfZKP75CvOlQylNhV4"; // wise, mature, balanced
const V_GEORGE  = "JBFqnCBsd6RMkjVDRZzb"; // warm, captivating storyteller (British)
// Female — young
const V_JESSICA = "cgSgspJ2msm6clMCkdW9"; // playful, bright, warm
const V_LAURA   = "FGY2WhTYpPnrIDTdsKH5"; // enthusiast, quirky
const V_SARAH   = "EXAVITQu4vr4xnSDxMaL"; // mature, reassuring, confident
// Female — middle-aged
const V_ALICE   = "Xb7hH8MSUJpSbSDYk0k2"; // clear, engaging educator (British)
const V_BELLA   = "hpp4J3VqNfWAUOO0d1Us"; // professional, bright, warm
const V_LILY    = "pFZP5JQG7iQjIQuC4Bku"; // velvety actress (British)
const V_MATILDA = "XrExE9yKIg1WjnnlVkGX"; // knowledgeable, professional
// Non-binary
const V_RIVER   = "SAz9YHcvj6GT2YYXdXww"; // relaxed, neutral

const DEFAULT_VOICE_ID = V_ERIC;

// Legacy export for files still importing PERSONA_VOICE_MAP
export const PERSONA_VOICE_MAP: Record<string, string> = {
  analytical: V_ERIC,
  anxious: V_BRIAN,
  impulsive: V_ADAM,
};

// ── Composite personality scores from OCEAN traits ─────────────────────
// These distill 5 raw traits into 3 intuitive axes that map well to voice
// qualities: how energetic, how tense, and how warm the persona sounds.

interface PersonalityScores {
  energy: number;      // 0-1: calm/patient → restless/curious
  sensitivity: number; // 0-1: resilient/forgiving → anxious/demanding
  warmth: number;      // 0-1: independent/critical → approachable/help-seeking
}

function computeScores(traits: Record<string, number> | null): PersonalityScores {
  if (!traits) return { energy: 0.5, sensitivity: 0.5, warmth: 0.5 };
  const t = (k: string) => traits[k] ?? 0.5;
  return {
    energy:      t("exploration") * 0.6 + (1 - t("patience")) * 0.4,
    sensitivity: t("frustrationSensitivity") * 0.6 + (1 - t("forgiveness")) * 0.4,
    warmth:      t("forgiveness") * 0.5 + t("helpSeeking") * 0.5,
  };
}

type AgeCategory = "young" | "middle" | "older";

function ageGroupToCategory(ageGroup: string | null): AgeCategory {
  if (!ageGroup) return "middle";
  if (ageGroup === "18-24" || ageGroup === "25-34") return "young";
  if (ageGroup === "35-44" || ageGroup === "45-54") return "middle";
  return "older"; // 55-64, 65+
}

// ── Voice selection per gender × age × personality ─────────────────────

function selectMaleYoung(s: PersonalityScores): string {
  // Liam — energetic social-media creator: impulse buyers, explorers
  if (s.energy > 0.6) return V_LIAM;
  // Will — relaxed optimist: anxious/sensitive young men (calming)
  if (s.sensitivity > 0.6) return V_WILL;
  // Charlie — confident, conversational: balanced default
  return V_CHARLIE;
}

function selectMaleMiddle(s: PersonalityScores): string {
  // Brian — deep, comforting: high-sensitivity personas (frustrated escalator, anxious)
  if (s.sensitivity > 0.6) return V_BRIAN;
  // Adam — dominant, firm: assertive low-warmth (business travelers, power users)
  if (s.energy > 0.6 && s.warmth < 0.4) return V_ADAM;
  // Chris — charming, down-to-earth: warm, help-seeking (caregivers, team admins)
  if (s.warmth > 0.6) return V_CHRIS;
  // Daniel — steady broadcaster: reserved, low-energy (security-conscious, privacy)
  if (s.energy < 0.4) return V_DANIEL;
  // Eric — smooth, trustworthy: balanced default
  return V_ERIC;
}

function selectMaleOlder(s: PersonalityScores): string {
  // George — warm storyteller: forgiving, warm older men (chronic condition, loyalty)
  if (s.warmth > 0.6) return V_GEORGE;
  // Roger — laid-back, casual: moderate energy older men
  if (s.energy > 0.5) return V_ROGER;
  // Bill — wise, mature, balanced: default older male
  return V_BILL;
}

function selectFemaleYoung(s: PersonalityScores): string {
  // Laura — enthusiast, quirky: high-energy explorers (impulse buyer, budget backpacker)
  if (s.energy > 0.6) return V_LAURA;
  // Jessica — playful, bright, warm: sensitive/anxious (first-time buyer, anxious patient)
  if (s.sensitivity > 0.6) return V_JESSICA;
  // Sarah — mature, reassuring, confident: balanced default
  return V_SARAH;
}

function selectFemaleMiddle(s: PersonalityScores): string {
  // Lily — velvety, soft: high-sensitivity (repeat-issue, luxury seeker)
  if (s.sensitivity > 0.6) return V_LILY;
  // Bella — professional, bright, warm: energetic (bargain hunter, planner)
  if (s.energy > 0.6) return V_BELLA;
  // Alice — clear, engaging educator: warm, help-seeking (family traveler, caregiver)
  if (s.warmth > 0.6) return V_ALICE;
  // Matilda — knowledgeable, professional: balanced default
  return V_MATILDA;
}

function selectFemaleOlder(s: PersonalityScores): string {
  // Alice — engaging educator: warm, patient older women
  if (s.warmth > 0.6) return V_ALICE;
  // Matilda — professional: default older female
  return V_MATILDA;
}

/** Select an ElevenLabs voice based on gender, age group, and personality traits. */
export function selectVoiceForPersona(
  gender: string | null,
  ageGroup: string | null,
  traits: Record<string, number> | null,
): string {
  const age = ageGroupToCategory(ageGroup);
  const scores = computeScores(traits);
  const g = (gender ?? "").toLowerCase();

  if (g === "female") {
    if (age === "young") return selectFemaleYoung(scores);
    if (age === "middle") return selectFemaleMiddle(scores);
    return selectFemaleOlder(scores);
  }

  if (g === "non-binary") return V_RIVER;

  // Male (default)
  if (age === "young") return selectMaleYoung(scores);
  if (age === "middle") return selectMaleMiddle(scores);
  return selectMaleOlder(scores);
}

/** @deprecated Use selectVoiceForPersona instead */
export function getVoiceIdForPersona(traits: Record<string, number> | null): string {
  return selectVoiceForPersona(null, null, traits);
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
