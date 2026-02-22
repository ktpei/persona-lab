import { NextRequest, NextResponse } from 'next/server';
import { speechToText, textToSpeech } from '@/lib/voice/elevenlabs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const personaId = formData.get('personaId') as string;
    
    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    // Convert audio file to ArrayBuffer
    const audioBuffer = await audioFile.arrayBuffer();
    
    // Transcribe audio to text
    let transcript: string;
    try {
      transcript = await speechToText(audioBuffer);
    } catch (error) {
      console.error('Speech-to-text error:', error);
      return NextResponse.json({ 
        error: 'Failed to transcribe audio',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }

    // Generate response text (persona-aware)
    let responseText: string;
    if (personaId) {
      responseText = `I heard you say: ${transcript}`;
    } else {
      responseText = `I heard you say: ${transcript}`;
    }

    // Convert response text to speech
    let responseAudio: ArrayBuffer;
    try {
      responseAudio = await textToSpeech(responseText);
    } catch (error) {
      console.error('Text-to-speech error:', error);
      // Return text fallback if TTS fails
      return NextResponse.json({
        transcript,
        text: responseText,
        error: 'Speech generation failed, returning text only'
      }, { status: 200 });
    }

    // Convert ArrayBuffer to base64 for JSON response
    const audioBase64 = Buffer.from(responseAudio).toString('base64');
    
    return NextResponse.json({
      transcript,
      text: responseText,
      audio: audioBase64,
      audioFormat: 'mp3'
    });

  } catch (error) {
    console.error('Voice chat API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
