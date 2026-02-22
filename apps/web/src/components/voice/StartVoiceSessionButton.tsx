'use client';

import { Mic } from 'lucide-react';

interface StartVoiceSessionButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export default function StartVoiceSessionButton({ onClick, disabled = false }: StartVoiceSessionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors
        ${disabled 
          ? 'border-border text-muted-foreground cursor-not-allowed bg-muted/20'
          : 'border-border text-foreground hover:bg-muted/40 hover:border-primary/40'
        }
      `}
    >
      <Mic className="h-4 w-4" />
      Start Voice Session
    </button>
  );
}
