"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { PersonaChat } from "@/components/persona-chat";
import { VoiceSessionPanel } from "@/components/voice/VoiceSessionPanel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, TrendingDown, Eye, MessageCircle, Phone } from "lucide-react";

interface Episode {
  id: string;
  status: string;
  persona: { id: string; name: string };
  _count: { steps: number };
}

interface Run {
  id: string;
  status: string;
  createdAt: string;
  episodes: Episode[];
  _count: { findings: number };
}

interface Finding {
  issue: string;
  evidence: string;
  severity: number;
  frequency: number;
  affectedPersonas: string[];
  elementRef?: string;
  stepIndex?: number;
  screenIndex?: number;
  recommendedFix?: string;
}

interface ScreenStats {
  screenIndex: number;
  avgFriction: number;
  maxFriction: number;
  avgDropoffRisk: number;
  confusionCount: number;
  findingCount: number;
  totalSteps: number;
}

interface Report {
  summary: {
    totalEpisodes: number;
    completedEpisodes: number;
    abandonedEpisodes: number;
    avgFriction: number;
    avgDropoffRisk: number;
  };
  findings: Finding[];
  perScreen?: ScreenStats[];
  perPersona: Array<{
    personaId: string;
    personaName: string;
    episodeStatus: string;
    avgFriction: number;
    avgConfidence: number;
    stepsCount: number;
    confusions: Array<{ issue: string; evidence: string; stepIndex: number; screenIndex?: number }>;
  }>;
}

const statusStyles: Record<string, string> = {
  PENDING: "bg-muted text-muted-foreground",
  RUNNING: "bg-primary/15 text-primary",
  SIMULATING: "bg-primary/15 text-primary",
  AGGREGATING: "bg-primary/15 text-primary",
  COMPLETED: "bg-primary/15 text-primary",
  ABANDONED: "bg-primary/15 text-primary",
  FAILED: "bg-destructive/15 text-destructive",
};

const statusLabels: Record<string, string> = {
  ABANDONED: "COMPLETED",
};

function frictionColor(value: number): string {
  if (value >= 0.6) return "text-red-400";
  if (value >= 0.3) return "text-amber-400";
  return "text-emerald-400";
}

function frictionBg(value: number): string {
  if (value >= 0.6) return "bg-red-400";
  if (value >= 0.3) return "bg-amber-400";
  return "bg-emerald-400";
}

export default function RunDetail() {
  const params = useParams<{ id: string; runId: string }>();
  const { runId } = params;
  const [run, setRun] = useState<Run | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [chatEpisode, setChatEpisode] = useState<{ id: string; personaName: string } | null>(null);
  const [voiceSessionOpen, setVoiceSessionOpen] = useState(false);
  const [personas, setPersonas] = useState<any[]>([]);
  const [flows, setFlows] = useState<any[]>([]);

  const loadRun = useCallback(() => {
    fetch(`/api/runs/${runId}`)
      .then((r) => r.json())
      .then(setRun);
  }, [runId]);

  useEffect(() => {
    loadRun();
  }, [loadRun]);

  useEffect(() => {
    if (!params.id) return;
    
    // Fetch personas and flows for the project
    Promise.all([
      fetch(`/api/projects/${params.id}/personas`).then(r => r.json()),
      fetch(`/api/projects/${params.id}/flows`).then(r => r.json())
    ]).then(([personasData, flowsData]) => {
      setPersonas(personasData);
      setFlows(flowsData);
    });
  }, [params.id]);

  useEffect(() => {
    if (!run || run.status === "COMPLETED" || run.status === "FAILED") return;
    const interval = setInterval(loadRun, 3000);
    return () => clearInterval(interval);
  }, [run?.status, loadRun]);

  useEffect(() => {
    if (run?.status !== "COMPLETED") return;
    fetch(`/api/runs/${runId}/report`)
      .then((r) => r.json())
      .then((data) => setReport(data.report));
  }, [run?.status, runId]);

  // Group findings by screen
  const findingsByScreen = useMemo(() => {
    if (!report) return new Map<number, Finding[]>();
    const map = new Map<number, Finding[]>();
    for (const f of report.findings) {
      const screen = f.screenIndex ?? 0;
      if (!map.has(screen)) map.set(screen, []);
      map.get(screen)!.push(f);
    }
    return map;
  }, [report]);

  // Get screen stats map for quick lookup
  const screenStatsMap = useMemo(() => {
    if (!report?.perScreen) return new Map<number, ScreenStats>();
    const map = new Map<number, ScreenStats>();
    for (const s of report.perScreen) map.set(s.screenIndex, s);
    return map;
  }, [report]);

  // Get all screen indices (union of perScreen and findingsByScreen keys)
  const screenIndices = useMemo(() => {
    const set = new Set<number>();
    if (report?.perScreen) for (const s of report.perScreen) set.add(s.screenIndex);
    for (const k of findingsByScreen.keys()) set.add(k);
    return Array.from(set).sort((a, b) => a - b);
  }, [report, findingsByScreen]);

  if (!run) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold text-foreground">Run {run.id.slice(0, 8)}</h2>
        <StatusPill status={run.status} />
      </div>

      {/* Episodes */}
      <section>
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">
          Episodes
        </h3>
        <div className="divide-y divide-border/40">
          {run.episodes.map((ep) => (
            <div key={ep.id} className="flex items-center justify-between py-3 px-1">
              <div>
                <span className="text-[15px] font-medium text-foreground">{ep.persona.name}</span>
                <span className="ml-2 text-sm text-muted-foreground">
                  {ep._count.steps} steps
                </span>
              </div>
              <div className="flex items-center gap-2">
                {run.status === "COMPLETED" && (
                  <>
                    <button
                      onClick={() => setChatEpisode({ id: ep.id, personaName: ep.persona.name })}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    >
                      <MessageCircle className="w-3 h-3" />
                      Chat
                    </button>
                    <button
                      onClick={() => setVoiceSessionOpen(true)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border border-border/60 text-foreground hover:bg-muted/40 transition-colors"
                      title="Talk through this run using voice"
                    >
                      <Phone className="w-3 h-3" />
                      Voice
                    </button>
                  </>
                )}
                <StatusPill status={ep.status} />
                {ep.status === "ABANDONED" && (
                  <span className="text-xs text-amber-400">Abandoned flow</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Loading spinner */}
      {run.status !== "COMPLETED" && run.status !== "FAILED" && (
        <div className="flex flex-col items-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-r-transparent" />
          <p className="text-sm text-muted-foreground mt-3">
            {run.status === "SIMULATING" && "Simulating personas..."}
            {run.status === "AGGREGATING" && "Generating report..."}
            {run.status === "PENDING" && "Starting..."}
          </p>
        </div>
      )}

      {/* Report */}
      {report && (
        <>
          {/* Summary */}
          <section>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">
              Summary
            </h3>
            <div className="grid grid-cols-5 gap-px rounded overflow-hidden border border-border/50">
              <StatCell label="Total" value={report.summary.totalEpisodes} />
              <StatCell label="Completed" value={report.summary.completedEpisodes} />
              <StatCell label="Dropped Off" value={report.summary.abandonedEpisodes} />
              <StatCell
                label="Avg Friction"
                value={report.summary.avgFriction.toFixed(2)}
                colorClass={frictionColor(report.summary.avgFriction)}
              />
              <StatCell
                label="Avg Drop-off"
                value={report.summary.avgDropoffRisk.toFixed(2)}
                colorClass={frictionColor(report.summary.avgDropoffRisk)}
              />
            </div>
          </section>

          {/* Per-screen friction heatmap */}
          {report.perScreen && report.perScreen.length > 0 && (
            <section>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">
                Friction by Frame
              </h3>
              <div className="flex gap-1.5 items-end">
                {report.perScreen.map((s) => (
                  <div key={s.screenIndex} className="flex-1 min-w-0">
                    <div className="relative bg-muted rounded-sm overflow-hidden" style={{ height: 80 }}>
                      <div
                        className={`absolute bottom-0 left-0 right-0 ${frictionBg(s.avgFriction)} transition-all`}
                        style={{ height: `${Math.max(s.avgFriction * 100, 4)}%`, opacity: 0.8 }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className={`text-sm font-semibold ${frictionColor(s.avgFriction)}`}>
                          {s.avgFriction.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="text-center mt-1.5">
                      <div className="text-xs text-muted-foreground">Frame {s.screenIndex + 1}</div>
                      <div className="flex items-center justify-center gap-1.5 mt-0.5">
                        {s.confusionCount > 0 && (
                          <span className="text-[10px] text-amber-400 flex items-center gap-0.5">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            {s.confusionCount}
                          </span>
                        )}
                        {s.findingCount > 0 && (
                          <span className="text-[10px] text-red-400 flex items-center gap-0.5">
                            <Eye className="w-2.5 h-2.5" />
                            {s.findingCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Findings grouped by screen */}
          <section>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">
              Findings ({report.findings.length})
            </h3>
            {report.findings.length === 0 ? (
              <div className="border border-dashed border-border/50 rounded py-8 text-center">
                <p className="text-sm text-muted-foreground">No findings generated for this run.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {screenIndices.map((screenIdx) => {
                  const screenFindings = findingsByScreen.get(screenIdx) ?? [];
                  const stats = screenStatsMap.get(screenIdx);
                  if (screenFindings.length === 0) return null;

                  return (
                    <div key={screenIdx}>
                      {/* Frame header */}
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm font-semibold text-foreground">
                          Frame {screenIdx + 1}
                        </span>
                        {stats && (
                          <div className="flex items-center gap-3 text-xs">
                            <span className={`flex items-center gap-1 ${frictionColor(stats.avgFriction)}`}>
                              <AlertTriangle className="w-3 h-3" />
                              {stats.avgFriction.toFixed(2)} friction
                            </span>
                            <span className={`flex items-center gap-1 ${frictionColor(stats.avgDropoffRisk)}`}>
                              <TrendingDown className="w-3 h-3" />
                              {stats.avgDropoffRisk.toFixed(2)} drop-off
                            </span>
                            <span className="text-muted-foreground">
                              {stats.confusionCount} confusion{stats.confusionCount !== 1 ? "s" : ""}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Findings for this screen */}
                      <div className="border border-border/50 rounded divide-y divide-border/40">
                        {screenFindings.map((f, i) => (
                          <div key={i} className="py-3 px-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0 flex-1">
                                <p className="text-[15px] font-medium text-foreground">{f.issue}</p>
                                <p className="text-sm text-muted-foreground mt-1">{f.evidence}</p>
                                {f.recommendedFix && (
                                  <p className="text-sm text-primary mt-1.5">
                                    Fix: {f.recommendedFix}
                                  </p>
                                )}
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {f.affectedPersonas.map((p) => (
                                    <Badge key={p} variant="outline" className="text-[11px] font-normal">
                                      {p}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                              <div className="text-right shrink-0 space-y-1">
                                <div className={`text-sm font-semibold ${frictionColor(f.severity)}`}>
                                  {f.severity.toFixed(2)}
                                </div>
                                <div className="text-[11px] text-muted-foreground">{f.frequency}x reported</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Per-persona */}
          <section>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">
              Per-Persona
            </h3>
            <div className="divide-y divide-border/40">
              {report.perPersona.map((pp) => {
                const episode = run.episodes.find((ep) => ep.persona.id === pp.personaId);
                return (
                  <div key={pp.personaId} className="py-3 px-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[15px] font-medium text-foreground">{pp.personaName}</span>
                      <div className="flex items-center gap-2">
                        {episode && (
                          <>
                            <button
                              onClick={() => setChatEpisode({ id: episode.id, personaName: pp.personaName })}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                            >
                              <MessageCircle className="w-3 h-3" />
                              Chat
                            </button>
                            <button
                              onClick={() => setVoiceSessionOpen(true)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border border-border/60 text-foreground hover:bg-muted/40 transition-colors"
                              title="Talk through this run using voice"
                            >
                              <Phone className="w-3 h-3" />
                              Voice
                            </button>
                          </>
                        )}
                        <StatusPill status={pp.episodeStatus} />
                        {pp.episodeStatus === "ABANDONED" && (
                          <span className="text-xs text-amber-400">Abandoned flow</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">{pp.stepsCount} steps</span>
                      <span className={frictionColor(pp.avgFriction)}>
                        Friction {pp.avgFriction.toFixed(2)}
                      </span>
                      <span className="text-muted-foreground">
                        Confidence {pp.avgConfidence.toFixed(2)}
                      </span>
                      {pp.confusions.length > 0 && (
                        <span className="text-amber-400 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {pp.confusions.length} confusion{pp.confusions.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    {pp.confusions.length > 0 && (
                      <div className="mt-2 space-y-0.5">
                        {pp.confusions.map((c, ci) => (
                          <p key={ci} className="text-sm text-muted-foreground pl-3 border-l-2 border-border/50">
                            Frame {(c.screenIndex ?? 0) + 1}: {c.issue}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      {chatEpisode && (
        <PersonaChat
          episodeId={chatEpisode.id}
          personaName={chatEpisode.personaName}
          onClose={() => setChatEpisode(null)}
        />
      )}

      {voiceSessionOpen && (
        <Dialog open={voiceSessionOpen} onOpenChange={setVoiceSessionOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Voice Session</DialogTitle>
            </DialogHeader>
            <div className="pt-2">
              <VoiceSessionPanel
                personas={personas.map((p: any) => ({ id: p.id, name: p.name }))}
                flows={flows.map((f: any) => ({ id: f.id, name: f.name, _count: f._count }))}
                onClose={() => setVoiceSessionOpen(false)}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded px-2.5 py-0.5 text-xs font-medium ${
        statusStyles[status] ?? "bg-muted text-muted-foreground"
      }`}
    >
      {statusLabels[status] ?? status}
    </span>
  );
}

function StatCell({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: string | number;
  colorClass?: string;
}) {
  return (
    <div className="bg-card px-4 py-3 text-center">
      <div className={`text-xl font-semibold ${colorClass ?? "text-foreground"}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
