"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DEMOGRAPHIC_PRESETS,
  TRAIT_LABELS,
  SUBGROUP_CATEGORIES,
  SUBGROUP_TAGS,
  applySubgroupModifiers,
  generateArchetype,
} from "@persona-lab/shared";
import type { SubgroupTagType, TraitRange } from "@persona-lab/shared";
import { Trash2, Users, Plus, Search, X } from "lucide-react";

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
  subgroupTags?: string[];
  archetype?: string;
}

interface Persona {
  id: string;
  name: string;
  ageGroup: string | null;
  gender: string | null;
  traits: (PersonaTraits & { accessibilityNeeds?: string[]; subgroupTags?: string[]; archetype?: string }) | null;
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

const defaultModifiers = {
  patience: 0,
  exploration: 0,
  frustrationSensitivity: 0,
  forgiveness: 0,
  helpSeeking: 0,
};

// ---------- Page ----------

export default function PersonasPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const [personas, setPersonas] = useState<Persona[]>([]);

  const [name, setName] = useState("");
  const [ageGroup, setAgeGroup] = useState("25-34");
  const [gender, setGender] = useState("male");
  const [traits, setTraits] = useState<PersonaTraits>(defaultTraits);
  const [creating, setCreating] = useState(false);

  const [presetId, setPresetId] = useState(DEMOGRAPHIC_PRESETS[0].id);
  const [batchCount, setBatchCount] = useState(5);
  const [generating, setGenerating] = useState(false);
  const [generatedPersonas, setGeneratedPersonas] = useState<GeneratedPersona[]>([]);
  const [saving, setSaving] = useState(false);

  // Subgroup state
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [customTags, setCustomTags] = useState<SubgroupTagType[]>([]);
  const [tagSearchQuery, setTagSearchQuery] = useState("");
  const [showCustomTagDialog, setShowCustomTagDialog] = useState(false);

  // Custom tag form state
  const [customTagName, setCustomTagName] = useState("");
  const [customTagCategory, setCustomTagCategory] = useState<string>("cross-domain");
  const [customTagModifiers, setCustomTagModifiers] = useState(defaultModifiers);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/personas`)
      .then((r) => r.json())
      .then(setPersonas)
      .catch(() => {});
  }, [projectId]);

  // Compute archetype preview
  const archetypePreview = useMemo(() => {
    const preset = DEMOGRAPHIC_PRESETS.find((p) => p.id === presetId);
    if (!preset) return "";

    const allTags: SubgroupTagType[] = [];
    for (const id of selectedTagIds) {
      const found = SUBGROUP_TAGS.find((t) => t.id === id);
      if (found) allTags.push(found);
      else {
        const custom = customTags.find((t) => t.id === id);
        if (custom) allTags.push(custom);
      }
    }

    const ranges = allTags.length > 0
      ? applySubgroupModifiers(preset.traitRanges, allTags)
      : preset.traitRanges;

    return generateArchetype(ranges, allTags.map((t) => t.label));
  }, [presetId, selectedTagIds, customTags]);

  // Filtered tags for search
  const filteredTags = useMemo(() => {
    const q = tagSearchQuery.toLowerCase();
    const builtIn = q
      ? SUBGROUP_TAGS.filter((t) => t.label.toLowerCase().includes(q))
      : SUBGROUP_TAGS;
    const custom = q
      ? customTags.filter((t) => t.label.toLowerCase().includes(q))
      : customTags;
    return { builtIn, custom };
  }, [tagSearchQuery, customTags]);

  function toggleTag(id: string) {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function createCustomTag() {
    if (!customTagName.trim()) return;
    const id = `custom-${Date.now()}`;
    const tag: SubgroupTagType = {
      id,
      label: customTagName.trim(),
      category: customTagCategory as SubgroupTagType["category"],
      modifiers: { ...customTagModifiers },
      isCustom: true,
    };
    setCustomTags((prev) => [...prev, tag]);
    setSelectedTagIds((prev) => [...prev, id]);
    setCustomTagName("");
    setCustomTagCategory("cross-domain");
    setCustomTagModifiers(defaultModifiers);
    setShowCustomTagDialog(false);
  }

  function removeCustomTag(id: string) {
    setCustomTags((prev) => prev.filter((t) => t.id !== id));
    setSelectedTagIds((prev) => prev.filter((x) => x !== id));
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
    setGenerating(true);
    setGeneratedPersonas([]);
    try {
      // Resolve custom subgroups to send
      const customSubgroupsToSend = customTags.filter((t) =>
        selectedTagIds.includes(t.id)
      );
      // Built-in tag IDs only
      const builtInTagIds = selectedTagIds.filter(
        (id) => !customTags.some((t) => t.id === id)
      );

      const res = await fetch("/api/personas/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          presetId,
          count: batchCount,
          subgroupTagIds: builtInTagIds.length > 0 ? builtInTagIds : undefined,
          customSubgroups: customSubgroupsToSend.length > 0 ? customSubgroupsToSend : undefined,
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
      prev.map((p, i) => (i === index ? { ...p, name: newName } : p))
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

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-foreground">Manage Personas</h2>

      <Tabs defaultValue="manual">
        <TabsList>
          <TabsTrigger value="manual">Manual</TabsTrigger>
          <TabsTrigger value="batch">Batch Generate</TabsTrigger>
        </TabsList>

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

        {/* ===== Batch Tab ===== */}
        <TabsContent value="batch">
          <div className="max-w-4xl space-y-5 pt-2">
            {/* Side-by-side: Demographics + Subgroup Tags */}
            <div className="grid gap-5 lg:grid-cols-2">
              {/* Left — Demographic preset picker */}
              <div className="space-y-1.5">
                <Label className="text-sm text-foreground">Demographic Preset</Label>
                <div className="rounded border border-border/60 p-3 space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {DEMOGRAPHIC_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => setPresetId(preset.id)}
                        className={`rounded border px-2.5 py-1 text-xs transition-colors ${
                          presetId === preset.id
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right — Subgroup tag picker */}
              <div className="space-y-1.5">
                <Label className="text-sm text-foreground">Subgroup Tags</Label>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={tagSearchQuery}
                    onChange={(e) => setTagSearchQuery(e.target.value)}
                    placeholder="Search tags..."
                    className="pl-8 h-8 text-sm"
                  />
                  {tagSearchQuery && (
                    <button
                      onClick={() => setTagSearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Tag pool */}
                <div className="max-h-64 overflow-y-auto rounded border border-border/60 p-3 space-y-3">
                  {SUBGROUP_CATEGORIES.map((cat) => {
                    const catTags = filteredTags.builtIn.filter((t) => t.category === cat.id);
                    if (catTags.length === 0) return null;
                    return (
                      <div key={cat.id}>
                        <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1.5">
                          {cat.label}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {catTags.map((tag) => {
                            const selected = selectedTagIds.includes(tag.id);
                            return (
                              <button
                                key={tag.id}
                                onClick={() => toggleTag(tag.id)}
                                className={`rounded border px-2.5 py-1 text-xs transition-colors ${
                                  selected
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground"
                                }`}
                              >
                                {tag.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {/* Custom tags section */}
                  {filteredTags.custom.length > 0 && (
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1.5">
                        Custom
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {filteredTags.custom.map((tag) => {
                          const selected = selectedTagIds.includes(tag.id);
                          return (
                            <span key={tag.id} className="inline-flex items-center gap-0.5">
                              <button
                                onClick={() => toggleTag(tag.id)}
                                className={`rounded-l border border-r-0 px-2.5 py-1 text-xs transition-colors ${
                                  selected
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground"
                                }`}
                              >
                                {tag.label}
                              </button>
                              <button
                                onClick={() => removeCustomTag(tag.id)}
                                className={`rounded-r border px-1 py-1 text-xs transition-colors ${
                                  selected
                                    ? "border-primary bg-primary/10 text-primary hover:bg-destructive/10 hover:text-destructive hover:border-destructive"
                                    : "border-border/60 text-muted-foreground hover:text-destructive hover:border-destructive"
                                }`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Add custom tag button */}
                  <button
                    onClick={() => setShowCustomTagDialog(true)}
                    className="flex items-center gap-1.5 rounded border border-dashed border-border/60 px-2.5 py-1 text-xs text-muted-foreground hover:border-border hover:text-foreground transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                    Custom Tag
                  </button>
                </div>

                {/* Selected tags summary */}
                {selectedTagIds.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground self-center mr-1">Selected:</span>
                    {selectedTagIds.map((id) => {
                      const tag = SUBGROUP_TAGS.find((t) => t.id === id) || customTags.find((t) => t.id === id);
                      if (!tag) return null;
                      return (
                        <Badge
                          key={id}
                          variant="secondary"
                          className="text-[11px] font-normal gap-1 cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-colors"
                          onClick={() => toggleTag(id)}
                        >
                          {tag.label}
                          <X className="h-2.5 w-2.5" />
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Archetype preview */}
            {archetypePreview && (
              <div className="rounded border border-dashed border-border/60 px-4 py-3">
                <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                  Archetype Preview
                </p>
                <p className="text-[15px] italic text-foreground/80">{archetypePreview}</p>
              </div>
            )}

            <div className="flex items-end gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm text-foreground">Count</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={batchCount}
                  onChange={(e) => setBatchCount(Number(e.target.value))}
                  className="w-24"
                />
              </div>
              <Button onClick={generateBatch} disabled={generating}>
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
                      {p.archetype && (
                        <p className="text-xs italic text-muted-foreground pl-0.5">{p.archetype}</p>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex gap-3">
                          {TRAIT_KEYS.map((key) => (
                            <MiniBar key={key} label={TRAIT_LABELS[key].label.slice(0, 3)} value={p.traits[key]} />
                          ))}
                        </div>
                        {p.subgroupTags && p.subgroupTags.length > 0 && (
                          <div className="flex gap-1 flex-wrap">
                            {p.subgroupTags.map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-[10px] font-normal">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Existing personas */}
      {personas.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
            All Personas ({personas.length})
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {personas.map((p) => {
              const t = p.traits;
              return (
                <div
                  key={p.id}
                  className="group rounded border border-border/60 p-4 hover:border-border transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-[15px] font-medium text-foreground">{p.name}</p>
                      {(p.ageGroup || p.gender) && (
                        <div className="flex gap-1 mt-1 flex-wrap">
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
                          {t?.subgroupTags?.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-[10px] font-normal bg-primary/5 text-primary/80 border-primary/20">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {t?.archetype && (
                        <p className="text-xs italic text-muted-foreground mt-1">{t.archetype}</p>
                      )}
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
                          <span className="w-20 text-xs text-muted-foreground truncate">
                            {TRAIT_LABELS[key].label}
                          </span>
                          <div className="flex-1 h-1 rounded-full bg-border/60">
                            <div
                              className="h-full rounded-full bg-primary/60"
                              style={{ width: `${(t[key] ?? 0) * 100}%` }}
                            />
                          </div>
                          <span className="w-7 text-right text-[11px] text-muted-foreground tabular-nums">
                            {(t[key] ?? 0).toFixed(1)}
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
        <div className="flex flex-col items-center justify-center rounded border border-dashed border-border/60 py-16">
          <div className="flex h-12 w-12 items-center justify-center rounded border border-border bg-muted">
            <Users className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="mt-4 text-[15px] font-medium text-foreground">No personas yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create personas manually or generate a batch.
          </p>
        </div>
      )}

      {/* Custom tag dialog */}
      <Dialog open={showCustomTagDialog} onOpenChange={setShowCustomTagDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Custom Subgroup Tag</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-sm text-foreground">Tag Name</Label>
              <Input
                value={customTagName}
                onChange={(e) => setCustomTagName(e.target.value)}
                placeholder="e.g., VIP customer, beta tester"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm text-foreground">Category</Label>
              <Select value={customTagCategory} onValueChange={setCustomTagCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUBGROUP_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label className="text-sm text-foreground">Trait Modifiers</Label>
              <p className="text-xs text-muted-foreground">
                Adjust how this subgroup shifts trait ranges. Negative values lower, positive raise.
              </p>
              {TRAIT_KEYS.map((key) => (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground">{TRAIT_LABELS[key].label}</span>
                    <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">
                      {customTagModifiers[key] >= 0 ? "+" : ""}{customTagModifiers[key].toFixed(2)}
                    </span>
                  </div>
                  <Slider
                    value={[customTagModifiers[key]]}
                    onValueChange={([v]) =>
                      setCustomTagModifiers((prev) => ({ ...prev, [key]: v }))
                    }
                    min={-0.3}
                    max={0.3}
                    step={0.05}
                  />
                </div>
              ))}
            </div>

            <Button
              onClick={createCustomTag}
              disabled={!customTagName.trim()}
              className="w-full"
            >
              Create Tag
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
