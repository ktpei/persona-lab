"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  PERSONA_GROUPS,
  TRAIT_LABELS,
} from "@persona-lab/shared";
import type { PersonaGroupType, PersonaArchetypeType } from "@persona-lab/shared";
import { Trash2, Users, Check } from "lucide-react";

// ---------- Types ----------

interface PersonaTraits {
  patience: number;
  exploration: number;
  frustrationSensitivity: number;
  forgiveness: number;
  helpSeeking: number;
}

interface GeneratedPersona {
  name: string;
  ageGroup: string;
  gender: string;
  traits: PersonaTraits;
  accessibilityNeeds: string[];
  archetype: string;
  groupId: string;
}

interface Persona {
  id: string;
  name: string;
  ageGroup: string | null;
  gender: string | null;
  traits: (PersonaTraits & { accessibilityNeeds?: string[]; archetype?: string; groupId?: string }) | null;
  knobs: Record<string, unknown> | null;
}

const TRAIT_KEYS: (keyof PersonaTraits)[] = [
  "patience",
  "exploration",
  "frustrationSensitivity",
  "forgiveness",
  "helpSeeking",
];

const AGE_GROUPS = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
const GENDERS = ["male", "female", "non-binary"];

const defaultTraits: PersonaTraits = {
  patience: 0.5,
  exploration: 0.5,
  frustrationSensitivity: 0.5,
  forgiveness: 0.5,
  helpSeeking: 0.5,
};

// ---------- Page ----------

export default function PersonasPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const [personas, setPersonas] = useState<Persona[]>([]);

  // Manual tab state
  const [name, setName] = useState("");
  const [ageGroup, setAgeGroup] = useState("25-34");
  const [gender, setGender] = useState("male");
  const [traits, setTraits] = useState<PersonaTraits>(defaultTraits);
  const [creating, setCreating] = useState(false);

  // Batch tab state
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [disabledArchetypeIds, setDisabledArchetypeIds] = useState<string[]>([]);
  const [perArchetype, setPerArchetype] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [generatedPersonas, setGeneratedPersonas] = useState<GeneratedPersona[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/personas`)
      .then((r) => r.json())
      .then(setPersonas)
      .catch(() => {});
  }, [projectId]);

  // Collect active archetypes from selected groups
  const activeArchetypes = useMemo(() => {
    const result: { archetype: PersonaArchetypeType; group: PersonaGroupType }[] = [];
    for (const groupId of selectedGroupIds) {
      const group = PERSONA_GROUPS.find((g) => g.id === groupId);
      if (!group) continue;
      for (const arch of group.archetypes) {
        result.push({ archetype: arch, group });
      }
    }
    return result;
  }, [selectedGroupIds]);

  const enabledCount = activeArchetypes.filter(
    (a) => !disabledArchetypeIds.includes(a.archetype.id),
  ).length;

  function toggleGroup(id: string) {
    setSelectedGroupIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      // When a group is removed, clear any disabled archetypes from that group
      if (!next.includes(id)) {
        const group = PERSONA_GROUPS.find((g) => g.id === id);
        if (group) {
          const archIds = new Set(group.archetypes.map((a) => a.id));
          setDisabledArchetypeIds((d) => d.filter((x) => !archIds.has(x)));
        }
      }
      return next;
    });
  }

  function toggleArchetype(id: string) {
    setDisabledArchetypeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function createPersona() {
    setCreating(true);
    const res = await fetch("/api/personas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, name, ageGroup, gender, traits }),
    });
    if (res.ok) {
      const persona = await res.json();
      setPersonas((prev) => [persona, ...prev]);
      setName("");
      setTraits(defaultTraits);
    }
    setCreating(false);
  }

  function updateTrait(key: keyof PersonaTraits, value: number) {
    setTraits((prev) => ({ ...prev, [key]: value }));
  }

  async function generateBatch() {
    const totalCount = enabledCount * perArchetype;
    if (totalCount === 0) return;
    setGenerating(true);
    setGeneratedPersonas([]);
    try {
      const res = await fetch("/api/personas/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          groupIds: selectedGroupIds,
          disabledArchetypeIds: disabledArchetypeIds.length > 0 ? disabledArchetypeIds : undefined,
          count: totalCount,
        }),
      });
      if (res.ok) setGeneratedPersonas(await res.json());
    } finally {
      setGenerating(false);
    }
  }

  function removeGenerated(index: number) {
    setGeneratedPersonas((prev) => prev.filter((_, i) => i !== index));
  }

  function updateGeneratedName(index: number, newName: string) {
    setGeneratedPersonas((prev) =>
      prev.map((p, i) => (i === index ? { ...p, name: newName } : p)),
    );
  }

  async function saveGeneratedBatch() {
    setSaving(true);
    try {
      const res = await fetch("/api/personas/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, personas: generatedPersonas }),
      });
      if (res.ok) {
        const saved = await res.json();
        setPersonas((prev) => [...saved, ...prev]);
        setGeneratedPersonas([]);
      }
    } finally {
      setSaving(false);
    }
  }

  async function deletePersona(personaId: string) {
    const res = await fetch(`/api/personas/${personaId}`, { method: "DELETE" });
    if (res.ok) setPersonas((prev) => prev.filter((p) => p.id !== personaId));
  }

  // Helper to find group label by id
  function groupLabel(groupId: string): string {
    return PERSONA_GROUPS.find((g) => g.id === groupId)?.label ?? groupId;
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-foreground tracking-tight">Manage Personas</h2>
        <p className="text-[13px] text-muted-foreground/60">
          {personas.length > 0
            ? <><span className="font-mono">{personas.length}</span> persona{personas.length !== 1 ? "s" : ""} created</>
            : "Create personas to simulate user behavior"}
        </p>
      </div>

      <Tabs defaultValue="batch">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="batch" className="text-[13px]">Batch Generate</TabsTrigger>
          <TabsTrigger value="manual" className="text-[13px]">Manual</TabsTrigger>
        </TabsList>

        {/* ===== Batch Tab ===== */}
        <TabsContent value="batch">
          <div className="max-w-5xl space-y-6 pt-2">
            {/* Group selector */}
            <div className="space-y-2">
              <Label className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground/50">
                Select Groups
              </Label>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {PERSONA_GROUPS.map((group) => {
                  const selected = selectedGroupIds.includes(group.id);
                  return (
                    <button
                      key={group.id}
                      onClick={() => toggleGroup(group.id)}
                      className={`relative rounded border p-3 text-left transition-all ${
                        selected
                          ? "border-primary bg-primary/5"
                          : "border-border/40 hover:border-border/70"
                      }`}
                    >
                      {selected && (
                        <div className="absolute right-2.5 top-2.5 flex h-4 w-4 items-center justify-center rounded bg-primary">
                          <Check className="h-3 w-3 text-primary-foreground" />
                        </div>
                      )}
                      <p className="text-[13px] font-medium text-foreground pr-5">{group.label}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground/60 line-clamp-2 leading-relaxed">
                        {group.description}
                      </p>
                      <p className="mt-2 text-[10px] text-muted-foreground/40 font-mono">
                        {group.archetypes.length} archetypes
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Archetypes panel */}
            {selectedGroupIds.length > 0 && (
              <div className="space-y-2">
                <Label className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground/50">
                  Archetypes <span className="font-mono text-foreground/60">{enabledCount}</span>
                </Label>
                <div className="max-h-80 overflow-y-auto rounded border border-border/40 divide-y divide-border/30">
                  {selectedGroupIds.map((groupId) => {
                    const group = PERSONA_GROUPS.find((g) => g.id === groupId);
                    if (!group) return null;
                    return (
                      <div key={groupId}>
                        <div className="sticky top-0 z-10 bg-card px-3 py-1.5 border-b border-border/40">
                          <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                            {group.label}
                          </p>
                        </div>
                        {group.archetypes.map((arch) => {
                          const disabled = disabledArchetypeIds.includes(arch.id);
                          return (
                            <div
                              key={arch.id}
                              className={`flex items-center gap-3 px-3 py-2 transition-opacity ${
                                disabled ? "opacity-40" : ""
                              }`}
                            >
                              {/* Checkbox */}
                              <button
                                onClick={() => toggleArchetype(arch.id)}
                                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-colors ${
                                  disabled
                                    ? "border-border/60 bg-transparent"
                                    : "border-primary bg-primary"
                                }`}
                              >
                                {!disabled && (
                                  <Check className="h-3 w-3 text-primary-foreground" />
                                )}
                              </button>

                              {/* Label + description */}
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-medium text-foreground truncate">
                                  {arch.label}
                                </p>
                                <p className="text-[11px] text-muted-foreground truncate">
                                  {arch.description}
                                </p>
                              </div>

                              {/* Mini trait bars */}
                              <div className="hidden sm:flex items-center gap-2 shrink-0">
                                {TRAIT_KEYS.map((key) => {
                                  const [lo, hi] = arch.traitRanges[key];
                                  const mid = (lo + hi) / 2;
                                  return (
                                    <MiniBar
                                      key={key}
                                      label={TRAIT_LABELS[key].label.slice(0, 3)}
                                      value={mid}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Per-archetype count + Generate */}
            <div className="flex items-end gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm text-foreground">Per Archetype</Label>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={perArchetype}
                  onChange={(e) => setPerArchetype(Math.max(1, Math.min(5, Number(e.target.value))))}
                  className="w-20"
                />
              </div>
              {enabledCount > 0 && (
                <p className="text-sm text-muted-foreground pb-2 tabular-nums">
                  {enabledCount} archetypes &times; {perArchetype} = <span className="text-foreground font-medium">{enabledCount * perArchetype}</span> personas
                </p>
              )}
              <Button
                onClick={generateBatch}
                disabled={generating || selectedGroupIds.length === 0 || enabledCount === 0}
              >
                {generating ? "Generating..." : "Generate Personas"}
              </Button>
            </div>

            {/* Generated personas review */}
            {generatedPersonas.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <p className="text-[15px] font-medium text-foreground">
                    Review ({generatedPersonas.length})
                  </p>
                  <Button
                    size="sm"
                    onClick={saveGeneratedBatch}
                    disabled={saving || generatedPersonas.length === 0}
                  >
                    {saving ? "Saving..." : "Save All"}
                  </Button>
                </div>
                <div className="divide-y divide-border/40">
                  {generatedPersonas.map((p, i) => (
                    <div key={i} className="py-2.5 space-y-1.5">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <Input
                            value={p.name}
                            onChange={(e) => updateGeneratedName(i, e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>
                        <button
                          onClick={() => removeGenerated(i)}
                          className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-[10px] font-normal bg-primary/5 text-primary/80 border-primary/20">
                          {p.archetype}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] font-normal">
                          {groupLabel(p.groupId)}
                        </Badge>
                        <Badge variant="secondary" className="text-[11px] font-normal">
                          {p.ageGroup}
                        </Badge>
                        <Badge variant="secondary" className="text-[11px] font-normal">
                          {p.gender}
                        </Badge>
                        <div className="flex gap-3 ml-1">
                          {TRAIT_KEYS.map((key) => (
                            <MiniBar key={key} label={TRAIT_LABELS[key].label.slice(0, 3)} value={p.traits[key]} />
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ===== Manual Tab ===== */}
        <TabsContent value="manual">
          <div className="max-w-xl space-y-5 pt-2">
            <div className="space-y-1.5">
              <Label className="text-sm text-foreground">Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Jake, Priya, Tomoko"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-sm text-foreground">Age Group</Label>
                <Select value={ageGroup} onValueChange={setAgeGroup}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AGE_GROUPS.map((ag) => (
                      <SelectItem key={ag} value={ag}>{ag}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-foreground">Gender</Label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GENDERS.map((g) => (
                      <SelectItem key={g} value={g}>
                        {g.charAt(0).toUpperCase() + g.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-sm text-foreground">Behavioral Traits</Label>
              {TRAIT_KEYS.map((key) => {
                const meta = TRAIT_LABELS[key];
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[15px] text-foreground">{meta.label}</span>
                      <span className="text-sm text-muted-foreground tabular-nums">
                        {traits[key].toFixed(2)}
                      </span>
                    </div>
                    <Slider
                      value={[traits[key]]}
                      onValueChange={([v]) => updateTrait(key, v)}
                      min={0}
                      max={1}
                      step={0.05}
                    />
                    <div className="flex justify-between text-[11px] text-muted-foreground/60">
                      <span>{meta.lowDesc}</span>
                      <span>{meta.highDesc}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <Button onClick={createPersona} disabled={!name.trim() || creating} className="w-full">
              {creating ? "Creating..." : "Create Persona"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Existing personas */}
      {personas.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-[11px] font-medium text-muted-foreground/50 uppercase tracking-widest">
              All Personas
            </h3>
            <span className="text-[11px] font-mono text-muted-foreground/40">{personas.length}</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {personas.map((p) => {
              const t = p.traits;
              return (
                <div
                  key={p.id}
                  className="group rounded border border-border/40 p-4 hover:border-border/70 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-[15px] font-medium text-foreground">{p.name}</p>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {t?.archetype && (
                          <Badge variant="secondary" className="text-[10px] font-normal bg-primary/5 text-primary/80 border-primary/20">
                            {t.archetype}
                          </Badge>
                        )}
                        {t?.groupId && (
                          <Badge variant="secondary" className="text-[10px] font-normal">
                            {groupLabel(t.groupId)}
                          </Badge>
                        )}
                        {p.ageGroup && (
                          <Badge variant="secondary" className="text-[11px] font-normal">
                            {p.ageGroup}
                          </Badge>
                        )}
                        {p.gender && (
                          <Badge variant="secondary" className="text-[11px] font-normal">
                            {p.gender}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => deletePersona(p.id)}
                      className="rounded p-1 text-muted-foreground/40 opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {t && (
                    <div className="space-y-1.5">
                      {TRAIT_KEYS.map((key) => (
                        <div key={key} className="flex items-center gap-2">
                          <span className="w-20 text-[11px] text-muted-foreground/60 truncate">
                            {TRAIT_LABELS[key].label}
                          </span>
                          <div className="flex-1 h-1 rounded-full bg-border/40">
                            <div
                              className="h-full rounded-full bg-primary/50"
                              style={{ width: `${(t[key] ?? 0) * 100}%` }}
                            />
                          </div>
                          <span className="w-7 text-right text-[10px] font-mono text-muted-foreground/40 tabular-nums">
                            {((t[key] ?? 0) * 100).toFixed(0)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {personas.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded border border-dashed border-border/40 py-16">
          <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-4 text-[15px] font-medium text-foreground">No personas yet</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Create personas manually or generate a batch.
          </p>
        </div>
      )}
    </div>
  );
}

function MiniBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-muted-foreground uppercase">{label}</span>
      <div className="w-8 h-1 rounded-full bg-border/60">
        <div className="h-full rounded-full bg-primary/50" style={{ width: `${value * 100}%` }} />
      </div>
    </div>
  );
}
