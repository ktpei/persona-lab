"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { AVAILABLE_MODELS, DEFAULT_MODEL } from "@persona-lab/shared";
import { Textarea } from "@/components/ui/textarea";
import {
  Pencil,
  Plus,
  Play,
  Workflow,
  Globe,
  Users,
  Trash2,
  Check,
  AlertTriangle,
} from "lucide-react";

// ---------- Interfaces ----------

interface Flow {
  id: string;
  name: string;
  mode: "SCREENSHOT" | "AGENT";
  url?: string;
  goal?: string;
  createdAt: string;
  _count?: { frames: number };
}

interface Persona {
  id: string;
  name: string;
  ageGroup: string | null;
  gender: string | null;
  traits: Record<string, number> | null;
  knobs: Record<string, unknown> | null;
}

interface Run {
  id: string;
  status: string;
  createdAt: string;
  _count?: { findings: number };
}

interface Project {
  id: string;
  name: string;
  description: string | null;
}

const statusStyles: Record<string, string> = {
  PENDING: "bg-muted text-muted-foreground",
  PARSING: "bg-muted text-muted-foreground",
  SIMULATING: "bg-primary/15 text-primary",
  AGGREGATING: "bg-primary/15 text-primary",
  COMPLETED: "bg-primary/15 text-primary",
  FAILED: "bg-destructive/15 text-destructive",
};

// ---------- Page ----------

export default function ProjectDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = params.id;

  const [project, setProject] = useState<Project | null>(null);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);

  // Flow dialog
  const [flowName, setFlowName] = useState("");
  const [flowMode, setFlowMode] = useState<"SCREENSHOT" | "AGENT">("SCREENSHOT");
  const [flowUrl, setFlowUrl] = useState("");
  const [flowGoal, setFlowGoal] = useState("");
  const [flowOpen, setFlowOpen] = useState(false);

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Run dialog
  const [runOpen, setRunOpen] = useState(false);
  const [selectedFlow, setSelectedFlow] = useState("");
  const [selectedPersonas, setSelectedPersonas] = useState<string[]>([]);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [maxSteps, setMaxSteps] = useState(30);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/projects`)
      .then((r) => r.json())
      .then((projects: Project[]) => {
        setProject(projects.find((p) => p.id === projectId) || null);
      });
  }, [projectId]);

  function loadData() {
    fetch(`/api/projects/${projectId}/flows`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setFlows)
      .catch(() => setFlows([]));

    fetch(`/api/projects/${projectId}/personas`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setPersonas)
      .catch(() => setPersonas([]));

    fetch(`/api/projects/${projectId}/runs`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setRuns)
      .catch(() => setRuns([]));
  }

  useEffect(() => {
    loadData();
  }, [projectId]);

  async function createFlow() {
    const payload: Record<string, string> = { projectId, name: flowName, mode: flowMode };
    if (flowMode === "AGENT") {
      payload.url = flowUrl;
      payload.goal = flowGoal;
    }
    const res = await fetch("/api/flows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const flow = await res.json();
      setFlows((prev) => [...prev, flow]);
      setFlowName("");
      setFlowMode("SCREENSHOT");
      setFlowUrl("");
      setFlowGoal("");
      setFlowOpen(false);
    }
  }

  async function deletePersona(personaId: string) {
    const res = await fetch(`/api/personas/${personaId}`, { method: "DELETE" });
    if (res.ok) setPersonas((prev) => prev.filter((p) => p.id !== personaId));
  }

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
      setRunOpen(false);
      setSelectedFlow("");
      setSelectedPersonas([]);
      setModel(DEFAULT_MODEL);
      setMaxSteps(30);
      loadData();
      router.push(`/projects/${projectId}/runs/${run.id}`);
    }
    setSubmitting(false);
  }

  async function deleteProject() {
    setDeleting(true);
    const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/");
      router.refresh();
    }
    setDeleting(false);
  }

  const canSubmitRun = selectedFlow && selectedPersonas.length > 0 && !submitting;

  return (
    <div className="space-y-6">
      {/* Project title + CTA */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-foreground">{project?.name ?? "..."}</h2>
          <Pencil className="h-4 w-4 text-muted-foreground/40" />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
          <Button
            variant="outline"
            className="gap-2 border-primary/40 text-primary hover:bg-primary/5 hover:text-primary"
            onClick={() => setRunOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Create Run
          </Button>
        </div>
      </div>

      {project?.description && (
        <p className="text-sm text-muted-foreground -mt-3">{project.description}</p>
      )}

      {/* Tabs — Flows, Personas, Runs */}
      <Tabs defaultValue="personas">
        <TabsList>
          <TabsTrigger value="personas">Personas</TabsTrigger>
          <TabsTrigger value="flows">Flows</TabsTrigger>
          <TabsTrigger value="runs">Runs</TabsTrigger>
        </TabsList>

        {/* ===== Flows Tab ===== */}
        <TabsContent value="flows">
          {flows.length === 0 ? (
            <EmptyState
              icon={Workflow}
              title="No flows yet"
              description="Create your first flow."
              actionLabel="Create Flow"
              onAction={() => setFlowOpen(true)}
            />
          ) : (
            <>
              <div className="flex justify-end mb-3">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-sm"
                  onClick={() => setFlowOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  New Flow
                </Button>
              </div>
              <div className="divide-y divide-border/40">
                {flows.map((f) => (
                  <Link key={f.id} href={f.mode === "AGENT" ? "#" : `/projects/${projectId}/flows/${f.id}`}>
                    <div className="group flex items-center justify-between py-3 px-2 hover:bg-muted/40 rounded transition-colors">
                      <div className="flex items-center gap-3">
                        {f.mode === "AGENT" ? (
                          <Globe className="h-4 w-4 text-primary/70" />
                        ) : (
                          <Workflow className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="text-[15px] text-foreground group-hover:text-primary transition-colors">
                          {f.name}
                        </span>
                        {f.mode === "AGENT" && f.url && (
                          <span className="text-xs text-muted-foreground truncate max-w-48">
                            {f.url}
                          </span>
                        )}
                      </div>
                      {f.mode === "AGENT" ? (
                        <Badge variant="secondary" className="text-[11px] font-normal">
                          Agent
                        </Badge>
                      ) : (
                        f._count && (
                          <span className="text-sm text-muted-foreground">
                            {f._count.frames} frames
                          </span>
                        )
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}

          <Dialog open={flowOpen} onOpenChange={setFlowOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Flow</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                {/* Mode toggle */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                    Mode
                  </Label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setFlowMode("SCREENSHOT")}
                      className={`flex-1 flex items-center justify-center gap-2 rounded border px-3 py-2.5 text-[15px] transition-colors ${
                        flowMode === "SCREENSHOT"
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border/60 text-foreground hover:border-border"
                      }`}
                    >
                      <Workflow className="h-4 w-4" />
                      Upload Screenshots
                    </button>
                    <button
                      onClick={() => setFlowMode("AGENT")}
                      className={`flex-1 flex items-center justify-center gap-2 rounded border px-3 py-2.5 text-[15px] transition-colors ${
                        flowMode === "AGENT"
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border/60 text-foreground hover:border-border"
                      }`}
                    >
                      <Globe className="h-4 w-4" />
                      Website URL
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="flowName">Name</Label>
                  <Input
                    id="flowName"
                    value={flowName}
                    onChange={(e) => setFlowName(e.target.value)}
                    placeholder={flowMode === "AGENT" ? "Homepage Signup Flow" : "Checkout Flow"}
                  />
                </div>

                {flowMode === "AGENT" && (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="flowUrl">Website URL</Label>
                      <Input
                        id="flowUrl"
                        type="url"
                        value={flowUrl}
                        onChange={(e) => setFlowUrl(e.target.value)}
                        placeholder="https://example.com"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="flowGoal">Goal</Label>
                      <Textarea
                        id="flowGoal"
                        value={flowGoal}
                        onChange={(e) => setFlowGoal(e.target.value)}
                        placeholder="Sign up for a free account and complete onboarding"
                        rows={2}
                      />
                    </div>
                  </>
                )}

                <Button
                  onClick={createFlow}
                  disabled={
                    !flowName.trim() ||
                    (flowMode === "AGENT" && (!flowUrl.trim() || !flowGoal.trim()))
                  }
                  className="w-full"
                >
                  Create
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ===== Personas Tab ===== */}
        <TabsContent value="personas">
          {personas.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No personas yet"
              description="Create personas to simulate user behavior."
              actionLabel="Manage Personas"
              onAction={() => router.push(`/projects/${projectId}/personas`)}
            />
          ) : (
            <>
              <div className="flex justify-end mb-3">
                <Link href={`/projects/${projectId}/personas`}>
                  <Button size="sm" variant="outline" className="gap-1.5 text-sm">
                    <Plus className="h-3.5 w-3.5" />
                    Manage Personas
                  </Button>
                </Link>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {personas.map((p) => (
                  <div
                    key={p.id}
                    className="group rounded border border-border/60 p-4 hover:border-border transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-[15px] font-medium text-foreground">{p.name}</p>
                        {(p.ageGroup || p.gender) && (
                          <div className="flex gap-1 mt-1">
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
                        )}
                      </div>
                      <button
                        onClick={() => deletePersona(p.id)}
                        className="rounded p-1 text-muted-foreground/40 opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    {p.traits && (
                      <div className="space-y-1.5">
                        {Object.entries(p.traits).map(([key, val]) => {
                          if (key === "accessibilityNeeds") return null;
                          return (
                            <div key={key} className="flex items-center gap-2">
                              <span className="w-20 text-xs text-muted-foreground truncate capitalize">
                                {key.replace(/([A-Z])/g, " $1").trim()}
                              </span>
                              <div className="flex-1 h-1 rounded-full bg-border/60">
                                <div
                                  className="h-full rounded-full bg-primary/60"
                                  style={{ width: `${(Number(val) ?? 0) * 100}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        {/* ===== Runs Tab ===== */}
        <TabsContent value="runs">
          {runs.length === 0 ? (
            <EmptyState
              icon={Play}
              title="No runs yet"
              description="Create your first run."
              actionLabel="Create Run"
              onAction={() => setRunOpen(true)}
            />
          ) : (
            <div className="divide-y divide-border/40">
              {runs.map((r) => (
                <Link key={r.id} href={`/projects/${projectId}/runs/${r.id}`}>
                  <div className="group flex items-center justify-between py-3 px-2 hover:bg-muted/40 rounded transition-colors">
                    <div className="flex items-center gap-3">
                      <Play className="h-4 w-4 text-muted-foreground" />
                      <span className="text-[15px] text-foreground group-hover:text-primary transition-colors">
                        Run {r.id.slice(0, 8)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {new Date(r.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <StatusPill status={r.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ===== Delete Project Dialog ===== */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Project
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-[15px] text-muted-foreground">
              Are you sure you want to delete <span className="font-medium text-foreground">{project?.name}</span>?
              This will permanently remove all flows, personas, runs, and findings associated with this project.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={deleteProject}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete Project"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== Create Run Dialog ===== */}
      <Dialog open={runOpen} onOpenChange={setRunOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Run</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 pt-2 max-h-[70vh] overflow-y-auto">
            {/* Flow selection */}
            <section>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                Flow
              </Label>
              <div className="mt-2 space-y-1.5">
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
                    <div className="flex items-center gap-2">
                      {f.mode === "AGENT" ? (
                        <Globe className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                      ) : (
                        <Workflow className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      )}
                      <span>{f.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {f.mode === "AGENT" ? (
                        <Badge variant="secondary" className="text-[11px] font-normal">Agent</Badge>
                      ) : (
                        f._count && (
                          <span className="text-sm text-muted-foreground">
                            {f._count.frames} frames
                          </span>
                        )
                      )}
                      {selectedFlow === f.id && <Check className="h-4 w-4 text-primary" />}
                    </div>
                  </button>
                ))}
                {flows.length === 0 && (
                  <p className="text-sm text-muted-foreground py-2">No flows available.</p>
                )}
              </div>
            </section>

            {/* Persona selection */}
            <section>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                Personas
              </Label>
              <div className="mt-2 space-y-1.5">
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

            <Button onClick={startRun} disabled={!canSubmitRun} className="w-full" size="lg">
              {submitting ? "Starting..." : "Start Run"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------- Shared Components ----------

function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded border border-dashed border-border/60 py-16">
      <div className="flex h-11 w-11 items-center justify-center rounded border border-border bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="mt-4 text-[15px] font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <Button
        variant="outline"
        className="mt-5 border-primary/40 text-primary hover:bg-primary/5"
        onClick={onAction}
      >
        {actionLabel}
      </Button>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
        statusStyles[status] ?? "bg-muted text-muted-foreground"
      }`}
    >
      {status}
    </span>
  );
}
