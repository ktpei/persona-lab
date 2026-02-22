'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';

interface VoiceResponse {
  transcript: string;
  text: string;
  audio?: string;
  audioFormat?: string;
  error?: string;
}

interface ProjectVoiceSessionProps {
  projectId: string;
  personaId: string;
  onClose: () => void;
}

export default function ProjectVoiceSession({ projectId, personaId, onClose }: ProjectVoiceSessionProps) {
  const [micActive, setMicActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startMic = async () => {
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await sendAudioToServer(audioBlob);
        
        // Stop all tracks to release the microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setMicActive(true);
    } catch (err) {
      setError('Failed to access microphone. Please grant microphone permissions.');
      console.error('Error accessing microphone:', err);
    }
  };

  const stopMic = () => {
    if (mediaRecorderRef.current && micActive) {
      mediaRecorderRef.current.stop();
      setMicActive(false);
      setIsProcessing(true);
    }
  };

  const sendAudioToServer = async (audioBlob: Blob) => {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const response = await fetch('/api/voice/chat', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process audio');
      }

      const data: VoiceResponse = await response.json();
      
      setTranscript(prev => prev + (prev ? '\n' : '') + data.transcript);
      setResponse(data.text);
      
      if (data.error) {
        setError(data.error);
      }

      // Play audio response if available
      if (data.audio) {
        await playAudioResponse(data.audio, data.audioFormat || 'mp3');
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error processing audio:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const playAudioResponse = async (audioBase64: string, format: string) => {
    try {
      const audioBytes = atob(audioBase64);
      const audioArray = new Uint8Array(audioBytes.length);
      
      for (let i = 0; i < audioBytes.length; i++) {
        audioArray[i] = audioBytes.charCodeAt(i);
      }

      const audioBlob = new Blob([audioArray], { type: `audio/${format}` });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      const audio = new Audio(audioUrl);
      await audio.play();
      
      // Clean up the object URL after playing
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
      };
    } catch (err) {
      console.error('Error playing audio:', err);
      setError('Failed to play audio response');
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && micActive) {
        mediaRecorderRef.current.stop();
      }
    };
  }, [micActive]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-foreground">Voice Session</h3>
        <button
          onClick={onClose}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Close Session
        </button>
      </div>

      {/* Microphone Control */}
      <div className="flex justify-center">
        <button
          onClick={micActive ? stopMic : startMic}
          disabled={isProcessing}
          className={`
            relative flex items-center justify-center w-16 h-16 rounded-full transition-all
            ${micActive
              ? 'bg-red-500 hover:bg-red-600 text-white border-4 border-red-200'
              : isProcessing
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed border-4 border-gray-200'
              : 'bg-primary hover:bg-primary/90 text-white border-4 border-primary/20'
            }
          `}
        >
          {isProcessing ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : micActive ? (
            <MicOff className="h-6 w-6" />
          ) : (
            <Mic className="h-6 w-6" />
          )}
        </button>
      </div>

      {/* Status Indicator */}
      <div className="text-center">
        {micActive && (
          <span className="inline-flex items-center text-sm text-red-600">
            <span className="animate-pulse w-2 h-2 bg-red-500 rounded-full mr-2"></span>
            Listening...
          </span>
        )}
        {isProcessing && (
          <span className="inline-flex items-center text-sm text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin mr-2" />
            Processing...
          </span>
        )}
        {!micActive && !isProcessing && (
          <span className="text-sm text-muted-foreground">
            Click microphone to start
          </span>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
          {error}
        </div>
      )}

      {/* Live Transcript */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-foreground">Live Transcript</h4>
        <div className="min-h-[100px] p-3 bg-muted/20 border border-border rounded-lg">
          {transcript ? (
            <div className="text-sm text-foreground whitespace-pre-wrap">{transcript}</div>
          ) : (
            <div className="text-sm text-muted-foreground">No speech detected yet...</div>
          )}
        </div>
      </div>

      {/* Response Display */}
      {response && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-foreground">Assistant Response</h4>
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="text-sm text-green-800">{response}</div>
          </div>
        </div>
      )}
    </div>
  );
}
