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
  Plus,
  Play,
  Workflow,
  Globe,
  Users,
  Trash2,
  Check,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { VoiceSessionPanel } from "@/components/voice/VoiceSessionPanel";
import { FocusGroupSession } from "@/components/voice/FocusGroupSession";

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

const statusColor: Record<string, string> = {
  PENDING: "secondary",
  PARSING: "secondary",
  SIMULATING: "default",
  AGGREGATING: "default",
  COMPLETED: "success",
  FAILED: "destructive",
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

  // Create flow dialog
  const [flowName, setFlowName] = useState("");
  const [flowMode, setFlowMode] = useState<"SCREENSHOT" | "AGENT">("SCREENSHOT");
  const [flowUrl, setFlowUrl] = useState("");
  const [flowGoal, setFlowGoal] = useState("");
  const [flowOpen, setFlowOpen] = useState(false);

  // Edit flow dialog
  const [editingFlow, setEditingFlow] = useState<Flow | null>(null);
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editGoal, setEditGoal] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Delete flow confirm
  const [deleteFlowId, setDeleteFlowId] = useState<string | null>(null);
  const [deletingFlow, setDeletingFlow] = useState(false);

  // Delete project dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Run dialog
  const [runOpen, setRunOpen] = useState(false);
  const [selectedFlow, setSelectedFlow] = useState("");
  const [selectedPersonas, setSelectedPersonas] = useState<string[]>([]);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [maxSteps, setMaxSteps] = useState(30);
  const [submitting, setSubmitting] = useState(false);

  // Voice session
  const [voiceSessionOpen, setVoiceSessionOpen] = useState(false);

  // Focus group session
  const [focusGroupOpen, setFocusGroupOpen] = useState(false);


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

  function openEditFlow(flow: Flow) {
    setEditingFlow(flow);
    setEditName(flow.name);
    setEditUrl(flow.url ?? "");
    setEditGoal(flow.goal ?? "");
    setEditOpen(true);
  }

  async function updateFlow() {
    if (!editingFlow) return;
    setUpdating(true);
    const payload: Record<string, string | null> = { name: editName };
    if (editingFlow.mode === "AGENT") {
      payload.url = editUrl;
      payload.goal = editGoal;
    }
    const res = await fetch(`/api/flows/${editingFlow.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const updated = await res.json();
      setFlows((prev) => prev.map((f) => (f.id === updated.id ? { ...f, ...updated } : f)));
      setEditOpen(false);
    }
    setUpdating(false);
  }

  async function deleteFlow() {
    if (!deleteFlowId) return;
    setDeletingFlow(true);
    const res = await fetch(`/api/flows/${deleteFlowId}`, { method: "DELETE" });
    if (res.ok) {
      setFlows((prev) => prev.filter((f) => f.id !== deleteFlowId));
      setDeleteFlowId(null);
      setEditOpen(false);
    }
    setDeletingFlow(false);
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
      router.push("/dashboard");
      router.refresh();
    }
    setDeleting(false);
  }

  const canSubmitRun = selectedFlow && selectedPersonas.length > 0 && !submitting;

  return (
    <div className="space-y-6">
      {/* Project header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-foreground tracking-tight">
            {project?.name ?? "..."}
          </h2>
          {project?.description && (
            <p className="text-[13px] text-muted-foreground/70 max-w-lg">{project.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-[13px] text-muted-foreground hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-[13px]"
            onClick={() => setFocusGroupOpen(true)}
          >
            <Users className="h-3.5 w-3.5" />
            Focus Group
          </Button>
          <Button
            size="sm"
            className="gap-1.5 text-[13px]"
            onClick={() => setRunOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            New Run
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="personas">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="personas" className="text-[13px]">
            Personas
            {personas.length > 0 && (
              <span className="ml-1.5 text-[11px] font-mono text-muted-foreground">{personas.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="flows" className="text-[13px]">
            Flows
            {flows.length > 0 && (
              <span className="ml-1.5 text-[11px] font-mono text-muted-foreground">{flows.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="runs" className="text-[13px]">
            Runs
            {runs.length > 0 && (
              <span className="ml-1.5 text-[11px] font-mono text-muted-foreground">{runs.length}</span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ===== Flows Tab ===== */}
        <TabsContent value="flows">
          {flows.length === 0 ? (
            <EmptyState
              icon={Workflow}
              title="No flows yet"
              description="Flows define the UX paths your personas will navigate."
              actionLabel="Create Flow"
              onAction={() => setFlowOpen(true)}
            />
          ) : (
            <>
              <div className="flex justify-end mb-3">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-[13px]"
                  onClick={() => setFlowOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  New Flow
                </Button>
              </div>
              <div className="rounded border border-border/40 divide-y divide-border/30 overflow-hidden">
                {flows.map((f) => (
                  <div
                    key={f.id}
                    className="group flex items-center justify-between py-3 px-4 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => openEditFlow(f)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded bg-muted/60">
                        {f.mode === "AGENT" ? (
                          <Globe className="h-3.5 w-3.5 text-primary/70" />
                        ) : (
                          <Workflow className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <span className="text-[13px] font-medium text-foreground group-hover:text-primary transition-colors">
                          {f.name}
                        </span>
                        {f.mode === "AGENT" && f.url && (
                          <span className="ml-2 text-[11px] text-muted-foreground/50 font-mono truncate max-w-48 inline-block align-middle">
                            {f.url}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {f.mode === "AGENT" ? (
                        <Badge variant="outline" className="text-[10px]">
                          Agent
                        </Badge>
                      ) : (
                        f._count && (
                          <span className="text-[12px] text-muted-foreground font-mono">
                            {f._count.frames} frames
                          </span>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <Dialog open={flowOpen} onOpenChange={setFlowOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create flow</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                {/* Mode toggle */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">
                    Mode
                  </Label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setFlowMode("SCREENSHOT")}
                      className={`flex-1 flex items-center justify-center gap-2 rounded border px-3 py-2 text-[13px] transition-colors ${
                        flowMode === "SCREENSHOT"
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border/60 text-foreground hover:border-border"
                      }`}
                    >
                      <Workflow className="h-3.5 w-3.5" />
                      Screenshots
                    </button>
                    <button
                      onClick={() => setFlowMode("AGENT")}
                      className={`flex-1 flex items-center justify-center gap-2 rounded border px-3 py-2 text-[13px] transition-colors ${
                        flowMode === "AGENT"
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border/60 text-foreground hover:border-border"
                      }`}
                    >
                      <Globe className="h-3.5 w-3.5" />
                      Website URL
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="flowName" className="text-[13px]">Name</Label>
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
                      <Label htmlFor="flowUrl" className="text-[13px]">Website URL</Label>
                      <Input
                        id="flowUrl"
                        type="url"
                        value={flowUrl}
                        onChange={(e) => setFlowUrl(e.target.value)}
                        placeholder="https://example.com"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="flowGoal" className="text-[13px]">Goal</Label>
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
          {/* ===== Edit Flow Dialog ===== */}
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit flow</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                {/* Mode (read-only) */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">
                    Mode
                  </label>
                  <div className="flex items-center gap-2 px-3 py-2 rounded border border-border/40 bg-muted/20">
                    {editingFlow?.mode === "AGENT" ? (
                      <Globe className="h-3.5 w-3.5 text-primary/70" />
                    ) : (
                      <Workflow className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <span className="text-[13px] text-muted-foreground">
                      {editingFlow?.mode === "AGENT" ? "Website URL" : "Screenshots"}
                    </span>
                    <span className="ml-auto text-[11px] text-muted-foreground/40">read-only</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px]">Name</label>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Flow name"
                  />
                </div>

                {editingFlow?.mode === "AGENT" && (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-[13px]">Website URL</label>
                      <Input
                        type="url"
                        value={editUrl}
                        onChange={(e) => setEditUrl(e.target.value)}
                        placeholder="https://example.com"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[13px]">Goal</label>
                      <Textarea
                        value={editGoal}
                        onChange={(e) => setEditGoal(e.target.value)}
                        placeholder="Sign up for a free account and complete onboarding"
                        rows={2}
                      />
                    </div>
                  </>
                )}

                <Button
                  onClick={updateFlow}
                  disabled={
                    !editName.trim() ||
                    (editingFlow?.mode === "AGENT" && (!editUrl.trim() || !editGoal.trim())) ||
                    updating
                  }
                  className="w-full"
                >
                  {updating ? "Saving..." : "Save changes"}
                </Button>

                <div className="pt-1 border-t border-border/30">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full gap-1.5 text-[13px] text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      setDeleteFlowId(editingFlow?.id ?? null);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete flow
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* ===== Delete Flow Confirm Dialog ===== */}
          <Dialog open={!!deleteFlowId} onOpenChange={(open) => { if (!open) setDeleteFlowId(null); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Delete flow
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <p className="text-[13px] text-muted-foreground leading-relaxed">
                  Are you sure you want to delete{" "}
                  <span className="font-medium text-foreground">
                    {flows.find((f) => f.id === deleteFlowId)?.name}
                  </span>
                  ? This will permanently remove the flow and all its frames.
                </p>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setDeleteFlowId(null)}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={deleteFlow}
                    disabled={deletingFlow}
                  >
                    {deletingFlow ? "Deleting..." : "Delete"}
                  </Button>
                </div>
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
              description="Create AI personas to simulate real user behavior on your flows."
              actionLabel="Manage Personas"
              onAction={() => router.push(`/projects/${projectId}/personas`)}
            />
          ) : (
            <>
              <div className="flex justify-end mb-3">
                <Link href={`/projects/${projectId}/personas`}>
                  <Button size="sm" variant="outline" className="gap-1.5 text-[13px]">
                    <Plus className="h-3.5 w-3.5" />
                    Manage Personas
                  </Button>
                </Link>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {personas.map((p) => (
                  <div
                    key={p.id}
                    className="group rounded border border-border/40 p-4 hover:border-border/70 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded bg-primary/10 text-[11px] font-semibold text-primary">
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-[13px] font-medium text-foreground">{p.name}</p>
                          {(p.ageGroup || p.gender) && (
                            <div className="flex gap-1 mt-0.5">
                              {p.ageGroup && (
                                <Badge variant="secondary" className="text-[10px]">
                                  {p.ageGroup}
                                </Badge>
                              )}
                              {p.gender && (
                                <Badge variant="secondary" className="text-[10px]">
                                  {p.gender}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => deletePersona(p.id)}
                        className="rounded p-1 text-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {p.traits && (
                      <div className="space-y-1.5">
                        {Object.entries(p.traits).map(([key, val]) => {
                          if (key === "accessibilityNeeds" || key === "groupId" || key === "archetype") return null;
                          return (
                            <div key={key} className="flex items-center gap-2">
                              <span className="w-20 text-[11px] text-muted-foreground/60 truncate capitalize">
                                {key.replace(/([A-Z])/g, " $1").trim()}
                              </span>
                              <div className="flex-1 h-1 rounded-full bg-border/40">
                                <div
                                  className="h-full rounded-full bg-primary/50"
                                  style={{ width: `${(Number(val) ?? 0) * 100}%` }}
                                />
                              </div>
                              <span className="text-[10px] font-mono text-muted-foreground/40 w-6 text-right">
                                {(Number(val) * 100).toFixed(0)}
                              </span>
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
              description="Start a simulation run to test your flows with personas."
              actionLabel="New Run"
              onAction={() => setRunOpen(true)}
            />
          ) : (
            <div className="rounded border border-border/40 divide-y divide-border/30 overflow-hidden">
              {runs.map((r) => (
                <Link key={r.id} href={`/projects/${projectId}/runs/${r.id}`}>
                  <div className="group flex items-center justify-between py-3 px-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded bg-muted/60">
                        <Play className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <div>
                        <span className="text-[13px] font-medium text-foreground group-hover:text-primary transition-colors font-mono">
                          {r.id.slice(0, 8)}
                        </span>
                        <span className="ml-2 text-[12px] text-muted-foreground/50">
                          {new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusPill status={r.status} />
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
                    </div>
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
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Delete project
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              Are you sure you want to delete <span className="font-medium text-foreground">{project?.name}</span>?
              This will permanently remove all flows, personas, runs, and findings.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setDeleteOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={deleteProject}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== Voice Session Dialog ===== */}
      <Dialog open={voiceSessionOpen} onOpenChange={setVoiceSessionOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Voice Session</DialogTitle>
          </DialogHeader>
          <div className="pt-2">
            <VoiceSessionPanel
              personas={personas.map((p) => ({ id: p.id, name: p.name }))}
              flows={flows.map((f) => ({ id: f.id, name: f.name, _count: f._count }))}
              onClose={() => setVoiceSessionOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== Focus Group Session Dialog ===== */}
      <Dialog open={focusGroupOpen} onOpenChange={setFocusGroupOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Focus Group Session</DialogTitle>
          </DialogHeader>
          <div className="pt-2">
            <FocusGroupSession
              personas={personas.map((p) => ({
                id: p.id,
                name: p.name,
                traits: p.traits || {
                  openness: 0.5,
                  conscientiousness: 0.5,
                  extraversion: 0.5,
                  agreeableness: 0.5,
                  neuroticism: 0.5
                }
              }))}
              flows={flows.map((f) => ({ id: f.id, name: f.name, _count: f._count }))}
              projectId={projectId}
              onClose={() => setFocusGroupOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>


      {/* ===== Create Run Dialog ===== */}
      <Dialog open={runOpen} onOpenChange={setRunOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New run</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2 max-h-[70vh] overflow-y-auto">
            {/* Flow selection */}
            <section>
              <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">
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
                        <Badge variant="outline" className="text-[10px]">Agent</Badge>
                      ) : (
                        f._count && (
                          <span className="text-[11px] text-muted-foreground font-mono">
                            {f._count.frames} frames
                          </span>
                        )
                      )}
                      {selectedFlow === f.id && <Check className="h-3.5 w-3.5 text-primary" />}
                    </div>
                  </button>
                ))}
                {flows.length === 0 && (
                  <p className="text-[13px] text-muted-foreground/60 py-2">No flows available.</p>
                )}
              </div>
            </section>

            {/* Persona selection */}
            <section>
              <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">
                Personas
                {selectedPersonas.length > 0 && (
                  <span className="ml-1 text-primary font-mono">{selectedPersonas.length}</span>
                )}
              </Label>
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
                        <span>{p.name}</span>
                        {p.ageGroup && (
                          <span className="text-[11px] text-muted-foreground/50">{p.ageGroup}</span>
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
              <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">
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
                  onChange={(e) => setMaxSteps(Number(e.target.value))}
                  min={1}
                  max={100}
                  className="w-24"
                />
              </div>
            </section>

            <Button onClick={startRun} disabled={!canSubmitRun} className="w-full">
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
    <div className="flex flex-col items-center justify-center rounded border border-dashed border-border/40 py-16">
      <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-4 text-[15px] font-medium text-foreground">{title}</p>
      <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>
      <Button
        size="sm"
        variant="outline"
        className="mt-4"
        onClick={onAction}
      >
        {actionLabel}
      </Button>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const variant = (statusColor[status] ?? "secondary") as "default" | "secondary" | "destructive" | "outline" | "success";
  return (
    <Badge variant={variant} className="text-[10px] uppercase tracking-wider">
      {status}
    </Badge>
  );
}
