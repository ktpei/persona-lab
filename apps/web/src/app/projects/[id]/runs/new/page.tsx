"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { AVAILABLE_MODELS, DEFAULT_MODEL } from "@persona-lab/shared";
import { Check } from "lucide-react";

interface Flow {
  id: string;
  name: string;
  _count: { frames: number };
}

interface Persona {
  id: string;
  name: string;
  ageGroup?: string;
  gender?: string;
}

export default function NewRunPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = params.id;

  const [flows, setFlows] = useState<Flow[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedFlow, setSelectedFlow] = useState("");
  const [selectedPersonas, setSelectedPersonas] = useState<string[]>([]);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [maxSteps, setMaxSteps] = useState(30);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/flows`)
      .then((r) => r.json())
      .then(setFlows)
      .catch(() => {});
    fetch(`/api/projects/${projectId}/personas`)
      .then((r) => r.json())
      .then(setPersonas)
      .catch(() => {});
  }, [projectId]);

  function togglePersona(id: string) {
    setSelectedPersonas((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  async function startRun() {
    setSubmitting(true);
    const res = await fetch("/api/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        flowId: selectedFlow,
        personaIds: selectedPersonas,
        config: { model, maxSteps },
      }),
    });
    if (res.ok) {
      const run = await res.json();
      router.push(`/projects/${projectId}/runs/${run.id}`);
    }
    setSubmitting(false);
  }

  const canSubmit = selectedFlow && selectedPersonas.length > 0 && !submitting;

  return (
    <div className="max-w-xl space-y-8">
      <h2 className="text-2xl font-bold text-foreground">New Run</h2>

      {/* Flow */}
      <section>
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
          Flow
        </Label>
        <div className="mt-2.5 space-y-1.5">
          {flows.map((f) => (
            <button
              key={f.id}
              onClick={() => setSelectedFlow(f.id)}
              className={`flex w-full items-center justify-between rounded border px-3.5 py-2.5 text-left text-[15px] transition-colors ${
                selectedFlow === f.id
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border/60 text-foreground hover:border-border"
              }`}
            >
              <span>{f.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{f._count.frames} frames</span>
                {selectedFlow === f.id && <Check className="h-4 w-4 text-primary" />}
              </div>
            </button>
          ))}
          {flows.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">No flows available.</p>
          )}
        </div>
      </section>

      {/* Personas */}
      <section>
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
          Personas
        </Label>
        <div className="mt-2.5 space-y-1.5">
          {personas.map((p) => {
            const selected = selectedPersonas.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => togglePersona(p.id)}
                className={`flex w-full items-center justify-between rounded border px-3.5 py-2.5 text-left text-[15px] transition-colors ${
                  selected
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border/60 text-foreground hover:border-border"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{p.name}</span>
                  {p.ageGroup && (
                    <span className="text-sm text-muted-foreground">{p.ageGroup}</span>
                  )}
                </div>
                {selected && <Check className="h-4 w-4 text-primary" />}
              </button>
            );
          })}
          {personas.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">No personas available.</p>
          )}
        </div>
      </section>

      {/* Config */}
      <section className="space-y-4">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
          Configuration
        </Label>
        <div className="space-y-1.5">
          <Label className="text-sm text-foreground">Model</Label>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AVAILABLE_MODELS.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                  <span className="ml-2 text-muted-foreground">
                    {m.provider} &middot; ${m.inputPrice.toFixed(2)} / ${m.outputPrice.toFixed(2)}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm text-foreground">Max Steps</Label>
          <Input
            type="number"
            value={maxSteps}
            onChange={(e) => setMaxSteps(Number(e.target.value))}
            min={1}
            max={100}
            className="w-24"
          />
        </div>
      </section>

      <Button onClick={startRun} disabled={!canSubmit} className="w-full" size="lg">
        {submitting ? "Starting..." : "Start Run"}
      </Button>
    </div>
  );
}
