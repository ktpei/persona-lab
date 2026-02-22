'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Mic, Square, Users, MessageSquare } from 'lucide-react';

interface Persona {
  id: string;
  name: string;
  traits: Record<string, number> | null;
}

interface FocusGroupSessionProps {
  personas: Persona[];
  flows: Array<{ id: string; name: string; _count?: { frames: number } }>;
  projectId: string;
  onClose?: () => void;
}

interface FocusGroupData {
  sessionId: string;
  projectId: string;
  flowId?: string;
  personas: Persona[];
  turnIndex: number;
  transcript: Array<{
    speaker: 'user' | string;
    text: string;
    personaName?: string;
  }>;
}

export function FocusGroupSession({
  personas,
  flows,
  projectId,
  onClose,
}: FocusGroupSessionProps) {
  const [selectedPersonaIds, setSelectedPersonaIds] = useState<string[]>([]);
  const [flowId, setFlowId] = useState('');
  const [focusGroupName, setFocusGroupName] = useState('');
  const [sessionStarted, setSessionStarted] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentSpeakerIndex, setCurrentSpeakerIndex] = useState(-1);
  
  const [focusGroupData, setFocusGroupData] = useState<FocusGroupData | null>(null);

  // Initialize focus group session
  const startFocusGroup = useCallback(() => {
    if (selectedPersonaIds.length === 0) return;

    const selectedPersonas = personas.filter(p => selectedPersonaIds.includes(p.id));
    
    const sessionData: FocusGroupData = {
      sessionId: `fg_${Date.now()}`,
      projectId,
      flowId: flowId || undefined,
      personas: selectedPersonas,
      turnIndex: 0,
      transcript: [],
    };

    setFocusGroupData(sessionData);
    setSessionStarted(true);
  }, [selectedPersonaIds, personas, projectId, flowId]);

  // Generate persona response
  const generatePersonaResponse = useCallback(async (
    persona: Persona, 
    transcript: FocusGroupData['transcript'], 
    userPrompt: string
  ): Promise<string> => {
    const context = transcript.map(t => 
      `${t.speaker === 'user' ? 'User' : t.personaName}: ${t.text}`
    ).join('\n');

    const traits = persona.traits || {
      openness: 0.5,
      conscientiousness: 0.5,
      extraversion: 0.5,
      agreeableness: 0.5,
      neuroticism: 0.5
    };

    const prompt = `You are participating in a UX research focus group.
Respond only when it is your turn.
Speak concisely.
Reference previous speakers if relevant.
Base all statements on your persona traits and the visible UX flow.

Your persona traits:
- Openness: ${traits.openness || 0.5}
- Conscientiousness: ${traits.conscientiousness || 0.5}
- Extraversion: ${traits.extraversion || 0.5}
- Agreeableness: ${traits.agreeableness || 0.5}
- Neuroticism: ${traits.neuroticism || 0.5}

Previous discussion:
${context}

User's latest input: "${userPrompt}"

Provide a concise, analytical response grounded in your persona traits:`;

    try {
      const response = await fetch('/api/focus-group/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          personaId: persona.id,
          personaName: persona.name,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate persona response');
      }

      const data = await response.json();
      return data.response || 'I need more context to respond.';
    } catch (error) {
      console.error('Error generating persona response:', error);
      return 'I need more context to respond.';
    }
  }, []);

  // Process user input and get sequential persona responses
  const processUserInput = useCallback(async () => {
    if (!userInput.trim() || !focusGroupData || isProcessing) return;

    setIsProcessing(true);

    // Add user input to transcript
    const updatedTranscript = [
      ...focusGroupData.transcript,
      { speaker: 'user' as const, text: userInput.trim() }
    ];

    let currentData = { ...focusGroupData, transcript: updatedTranscript };

    // Get responses from each persona in sequence
    for (let i = 0; i < focusGroupData.personas.length; i++) {
      const persona = focusGroupData.personas[i];
      setCurrentSpeakerIndex(i);

      const response = await generatePersonaResponse(
        persona, 
        currentData.transcript, 
        userInput.trim()
      );

      // Add persona response to transcript
      currentData = {
        ...currentData,
        transcript: [
          ...currentData.transcript,
          { 
            speaker: persona.id, 
            text: response,
            personaName: persona.name 
          }
        ]
      };

      // Update state to show real-time progress
      setFocusGroupData(currentData);
    }

    // Final update with complete transcript
    setFocusGroupData({
      ...currentData,
      turnIndex: currentData.turnIndex + 1
    });

    setCurrentSpeakerIndex(-1);
    setUserInput('');
    setIsProcessing(false);
  }, [userInput, focusGroupData, isProcessing, generatePersonaResponse]);

  // End session and clear memory
  const endSession = useCallback(() => {
    setFocusGroupData(null);
    setSessionStarted(false);
    setSelectedPersonaIds([]);
    setUserInput('');
    setCurrentSpeakerIndex(-1);
    setIsProcessing(false);
    onClose?.();
  }, [onClose]);

  if (!sessionStarted) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-foreground mb-4">Start Focus Group Session</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Select multiple personas to participate in a structured UX research discussion.
          </p>
        </div>

        <div className="space-y-4">
          <div className="grid gap-2">
            <Label>Focus Group Name (Optional)</Label>
            <Input
              placeholder="e.g., Homepage Navigation Feedback"
              value={focusGroupName}
              onChange={(e) => setFocusGroupName(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label>Select Personas</Label>
            <div className="space-y-2 max-h-40 overflow-y-auto border rounded-lg p-3">
              {personas.map((persona) => (
                <label key={persona.id} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedPersonaIds.includes(persona.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedPersonaIds([...selectedPersonaIds, persona.id]);
                      } else {
                        setSelectedPersonaIds(selectedPersonaIds.filter(id => id !== persona.id));
                      }
                    }}
                    className="rounded border-border"
                  />
                  <span className="text-sm">{persona.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Flow (Optional)</Label>
            <Select value={flowId} onValueChange={setFlowId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select flow" />
              </SelectTrigger>
              <SelectContent>
                {flows.map((flow) => (
                  <SelectItem key={flow.id} value={flow.id}>
                    {flow.name}
                    {flow._count?.frames != null ? ` (${flow._count.frames} screens)` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          {onClose && (
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          )}
          <Button
            onClick={startFocusGroup}
            disabled={selectedPersonaIds.length === 0}
            className="gap-2"
          >
            <Users className="h-4 w-4" />
            Begin Discussion
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-foreground">
            {focusGroupName || 'Focus Group Discussion'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {focusGroupData?.personas.length} personas participating
          </p>
        </div>
        <Button variant="outline" onClick={endSession} className="gap-2">
          <Square className="h-4 w-4" />
          End Session
        </Button>
      </div>

      {/* Participants */}
      <div className="flex flex-wrap gap-2">
        {focusGroupData?.personas.map((persona, index) => (
          <div
            key={persona.id}
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              currentSpeakerIndex === index
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {persona.name}
            {currentSpeakerIndex === index && ' (speaking...)'}
          </div>
        ))}
      </div>

      {/* Transcript */}
      <div className="border rounded-lg p-4 space-y-3 max-h-96 overflow-y-auto bg-muted/20">
        <div className="flex items-center gap-2 mb-4 pb-2 border-b">
          <MessageSquare className="h-4 w-4" />
          <span className="font-medium text-sm">Discussion Log</span>
        </div>
        
        {focusGroupData?.transcript.map((entry, index) => (
          <div key={index} className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`font-medium text-sm ${
                entry.speaker === 'user' 
                  ? 'text-blue-600' 
                  : 'text-purple-600'
              }`}>
                {entry.speaker === 'user' ? 'User' : entry.personaName}:
              </span>
            </div>
            <div className="text-sm text-foreground pl-4">
              {entry.text}
            </div>
          </div>
        ))}
        
        {isProcessing && (
          <div className="text-sm text-muted-foreground italic">
            Processing responses...
          </div>
        )}
      </div>

      {/* User Input */}
      <div className="flex gap-2">
        <Input
          placeholder="Share your thoughts about the design..."
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && processUserInput()}
          disabled={isProcessing}
          className="flex-1"
        />
        <Button
          onClick={processUserInput}
          disabled={!userInput.trim() || isProcessing}
          className="gap-2"
        >
          <MessageSquare className="h-4 w-4" />
          Share
        </Button>
      </div>
    </div>
  );
}
