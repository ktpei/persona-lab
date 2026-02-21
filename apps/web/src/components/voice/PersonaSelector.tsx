'use client';

import { useState, useEffect } from 'react';

interface Persona {
  id: string;
  name: string;
  traits?: Record<string, number>;
  description?: string;
}

interface PersonaSelectorProps {
  projectId: string;
  selectedPersonaId: string | null;
  onPersonaSelect: (personaId: string) => void;
  disabled?: boolean;
}

export default function PersonaSelector({ 
  projectId, 
  selectedPersonaId, 
  onPersonaSelect, 
  disabled = false 
}: PersonaSelectorProps) {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPersonas = async () => {
      try {
        const response = await fetch(`/api/personas?projectId=${projectId}`);
        if (response.ok) {
          const data = await response.json();
          setPersonas(data);
        }
      } catch (error) {
        console.error('Failed to fetch personas:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPersonas();
  }, [projectId]);

  const getTraitsSummary = (traits?: Record<string, number>) => {
    if (!traits) return 'No traits defined';
    
    const traitNames = Object.keys(traits);
    if (traitNames.length === 0) return 'No traits defined';
    
    return traitNames.slice(0, 3).map(trait => `${trait}: ${traits[trait]}`).join(', ');
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        Loading personas...
      </div>
    );
  }

  if (personas.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        No personas available for this project.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-foreground">Select a Persona</h3>
      <div className="space-y-2">
        {personas.map((persona) => (
          <label
            key={persona.id}
            className={`
              flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-colors
              ${selectedPersonaId === persona.id 
                ? 'border-primary bg-primary/5' 
                : 'border-border hover:bg-muted/40'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <input
              type="radio"
              name="persona"
              value={persona.id}
              checked={selectedPersonaId === persona.id}
              onChange={() => onPersonaSelect(persona.id)}
              disabled={disabled}
              className="mt-1"
            />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm text-foreground">
                {persona.name}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {persona.description || getTraitsSummary(persona.traits)}
              </div>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
