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
    <div className="max-w-xl space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-foreground tracking-tight">New Run</h2>
        <p className="text-[13px] text-muted-foreground/60">Configure and start a simulation run</p>
      </div>

      {/* Flow */}
      <section>
        <Label className="text-[11px] font-medium text-muted-foreground/50 uppercase tracking-widest">
          Flow
        </Label>
        <div className="mt-2 space-y-1">
          {flows.map((f) => (
            <button
              key={f.id}
              onClick={() => setSelectedFlow(f.id)}
              className={`flex w-full items-center justify-between rounded border px-3 py-2 text-left text-[13px] transition-colors ${
                selectedFlow === f.id
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border/40 text-foreground hover:border-border/70"
              }`}
            >
              <span className="font-medium">{f.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground font-mono">{f._count.frames} frames</span>
                {selectedFlow === f.id && <Check className="h-3.5 w-3.5 text-primary" />}
              </div>
            </button>
          ))}
          {flows.length === 0 && (
            <p className="text-[13px] text-muted-foreground/60 py-2">No flows available.</p>
          )}
        </div>
      </section>

      {/* Personas */}
      <section>
        <Label className="text-[11px] font-medium text-muted-foreground/50 uppercase tracking-widest">
          Personas
          {selectedPersonas.length > 0 && (
            <span className="ml-1 text-primary font-mono">{selectedPersonas.length}</span>
          )}
        </Label>

        {/* Group selection chips */}
        {personas.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            <GroupChip
              label="All"
              ids={personas.map((p) => p.id)}
              selectedPersonas={selectedPersonas}
              setSelectedPersonas={setSelectedPersonas}
            />
            {[...new Set(personas.map((p) => p.gender).filter(Boolean))].map((gender) => (
              <GroupChip
                key={gender}
                label={gender!}
                ids={personas.filter((p) => p.gender === gender).map((p) => p.id)}
                selectedPersonas={selectedPersonas}
                setSelectedPersonas={setSelectedPersonas}
              />
            ))}
            {[...new Set(personas.map((p) => p.ageGroup).filter(Boolean))].map((age) => (
              <GroupChip
                key={age}
                label={age!}
                ids={personas.filter((p) => p.ageGroup === age).map((p) => p.id)}
                selectedPersonas={selectedPersonas}
                setSelectedPersonas={setSelectedPersonas}
              />
            ))}
          </div>
        )}

        <div className="mt-2 space-y-1">
          {personas.map((p) => {
            const selected = selectedPersonas.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => togglePersona(p.id)}
                className={`flex w-full items-center justify-between rounded border px-3 py-2 text-left text-[13px] transition-colors ${
                  selected
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border/40 text-foreground hover:border-border/70"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{p.name}</span>
                  {p.ageGroup && (
                    <span className="text-[11px] text-muted-foreground/50">{p.ageGroup}</span>
                  )}
                  {p.gender && (
                    <span className="text-[11px] text-muted-foreground/50">{p.gender}</span>
                  )}
                </div>
                {selected && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            );
          })}
          {personas.length === 0 && (
            <p className="text-[13px] text-muted-foreground/60 py-2">No personas available.</p>
          )}
        </div>
      </section>

      {/* Config */}
      <section className="space-y-3">
        <Label className="text-[11px] font-medium text-muted-foreground/50 uppercase tracking-widest">
          Configuration
        </Label>
        <div className="space-y-1.5">
          <Label className="text-[13px] text-foreground">Model</Label>
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
          <Label className="text-[13px] text-foreground">Max Steps</Label>
          <Input
            type="number"
            value={maxSteps}
            onChange={(e) => {
              const v = e.target.valueAsNumber;
              if (!isNaN(v)) setMaxSteps(Math.min(30, Math.max(1, Math.round(v))));
            }}
            min={1}
            max={30}
            className="w-24"
          />
        </div>
      </section>

      <Button onClick={startRun} disabled={!canSubmit} className="w-full">
        {submitting ? "Starting..." : "Start Run"}
      </Button>
    </div>
  );
}

function GroupChip({
  label,
  ids,
  selectedPersonas,
  setSelectedPersonas,
}: {
  label: string;
  ids: string[];
  selectedPersonas: string[];
  setSelectedPersonas: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  const allSelected = ids.length > 0 && ids.every((id) => selectedPersonas.includes(id));

  function toggle() {
    if (allSelected) {
      setSelectedPersonas((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      setSelectedPersonas((prev) => [...new Set([...prev, ...ids])]);
    }
  }

  return (
    <button
      onClick={toggle}
      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium transition-colors ${
        allSelected
          ? "border-primary bg-primary/8 text-primary"
          : "border-border/40 text-muted-foreground/60 hover:border-border/70 hover:text-foreground"
      }`}
    >
      {label}
      <span className="font-mono opacity-50">{ids.length}</span>
    </button>
  );
}
