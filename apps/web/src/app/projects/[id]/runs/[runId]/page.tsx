"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { PersonaChat } from "@/components/persona-chat";
import {
  AlertTriangle,
  TrendingDown,
  Eye,
  MessageCircle,
  ChevronRight,
  Globe,
  Lightbulb,
  Users,
  BarChart3,
  ArrowRight,
  ChevronDown,
} from "lucide-react";

interface Episode {
  id: string;
  status: string;
  persona: { id: string; name: string };
  _count: { steps: number };
}

interface Run {
  id: string;
  status: string;
  mode: "SCREENSHOT" | "AGENT";
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
  screenLabel?: string;
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

function frictionBorder(value: number): string {
  if (value >= 0.6) return "border-red-400/60";
  if (value >= 0.3) return "border-amber-400/60";
  return "border-emerald-400/60";
}

function severityLabel(value: number): string {
  if (value >= 0.6) return "High";
  if (value >= 0.3) return "Medium";
  return "Low";
}

export default function RunDetail() {
  const params = useParams<{ id: string; runId: string }>();
  const { runId } = params;
  const [run, setRun] = useState<Run | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [chatEpisode, setChatEpisode] = useState<{ id: string; personaName: string } | null>(null);
  const [screenShots, setScreenShots] = useState<Map<number, string>>(new Map());
  const [expandedPersonas, setExpandedPersonas] = useState<Set<string>>(new Set());

  const loadRun = useCallback(() => {
    fetch(`/api/runs/${runId}`)
      .then((r) => r.json())
      .then(setRun);
  }, [runId]);

  useEffect(() => {
    loadRun();
  }, [loadRun]);

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
    fetch(`/api/runs/${runId}/screenshots`)
      .then((r) => r.json())
      .then((data) => {
        const map = new Map<number, string>();
        for (const s of data.screens ?? []) {
          map.set(s.screenIndex, s.stepId);
        }
        setScreenShots(map);
      })
      .catch(() => {});
  }, [run?.status, runId]);

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

  const screenStatsMap = useMemo(() => {
    if (!report?.perScreen) return new Map<number, ScreenStats>();
    const map = new Map<number, ScreenStats>();
    for (const s of report.perScreen) map.set(s.screenIndex, s);
    return map;
  }, [report]);

  const isAgentMode = run?.mode === "AGENT";

  const screenLabels = useMemo(() => {
    const map = new Map<number, string>();
    if (report?.perScreen) {
      for (const s of report.perScreen) {
        if (s.screenLabel) map.set(s.screenIndex, s.screenLabel);
      }
    }
    return map;
  }, [report]);

  const screenIndices = useMemo(() => {
    const set = new Set<number>();
    if (report?.perScreen) for (const s of report.perScreen) set.add(s.screenIndex);
    for (const k of findingsByScreen.keys()) set.add(k);
    return Array.from(set).sort((a, b) => a - b);
  }, [report, findingsByScreen]);

  function togglePersonaExpand(id: string) {
    setExpandedPersonas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (!run) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-muted rounded w-48" />
        <div className="grid grid-cols-5 gap-px">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-muted rounded" />
          ))}
        </div>
        <div className="h-40 bg-muted rounded" />
      </div>
    );
  }

  const completionRate = report
    ? Math.round((report.summary.completedEpisodes / report.summary.totalEpisodes) * 100)
    : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-foreground">Run {run.id.slice(0, 8)}</h2>
          <StatusPill status={run.status} />
          {isAgentMode && (
            <Badge variant="secondary" className="text-[11px] font-normal gap-1">
              <Globe className="w-3 h-3" />
              Agent
            </Badge>
          )}
        </div>
        <span className="text-sm text-muted-foreground">
          {new Date(run.createdAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      {/* Loading spinner */}
      {run.status !== "COMPLETED" && run.status !== "FAILED" && (
        <div className="flex flex-col items-center py-16 border border-dashed border-border/60 rounded">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-r-transparent" />
          <p className="text-[15px] text-muted-foreground mt-4">
            {run.status === "SIMULATING" && "Simulating personas..."}
            {run.status === "AGGREGATING" && "Generating report..."}
            {run.status === "RUNNING" && "Running episodes..."}
            {run.status === "PENDING" && "Starting..."}
          </p>
          <div className="mt-4 space-y-1">
            {run.episodes.map((ep) => (
              <div key={ep.id} className="flex items-center gap-2 text-sm">
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    ep.status === "COMPLETED" || ep.status === "ABANDONED"
                      ? "bg-emerald-400"
                      : ep.status === "RUNNING"
                        ? "bg-primary animate-pulse"
                        : "bg-muted-foreground/30"
                  }`}
                />
                <span className="text-muted-foreground">{ep.persona.name}</span>
                <span className="text-muted-foreground/50 text-xs">
                  {ep.status === "COMPLETED" || ep.status === "ABANDONED"
                    ? `${ep._count.steps} steps`
                    : ep.status === "RUNNING"
                      ? "running..."
                      : "pending"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Report */}
      {report && (
        <>
          {/* Summary stats */}
          <section>
            <SectionHeader icon={BarChart3} label="Summary" />
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <StatCard
                label="Personas"
                value={report.summary.totalEpisodes}
                sub={`${report.summary.completedEpisodes} completed`}
              />
              <StatCard
                label="Completion"
                value={`${completionRate}%`}
                sub={`${report.summary.abandonedEpisodes} dropped off`}
                colorClass={completionRate >= 80 ? "text-emerald-400" : completionRate >= 50 ? "text-amber-400" : "text-red-400"}
              />
              <StatCard
                label="Avg Friction"
                value={report.summary.avgFriction.toFixed(2)}
                sub={severityLabel(report.summary.avgFriction)}
                colorClass={frictionColor(report.summary.avgFriction)}
              />
              <StatCard
                label="Avg Drop-off"
                value={report.summary.avgDropoffRisk.toFixed(2)}
                sub={severityLabel(report.summary.avgDropoffRisk)}
                colorClass={frictionColor(report.summary.avgDropoffRisk)}
              />
              <StatCard
                label="Findings"
                value={report.findings.length}
                sub={`across ${screenIndices.length} ${isAgentMode ? "pages" : "frames"}`}
              />
            </div>
          </section>

          {/* Friction by page — hero section */}
          {report.perScreen && report.perScreen.length > 0 && (
            <section>
              <SectionHeader
                icon={isAgentMode ? Globe : Eye}
                label={isAgentMode ? "Friction by Page" : "Friction by Frame"}
              />
              <div className="border border-border/50 rounded bg-card p-5 overflow-x-auto">
                <div className="flex items-start gap-2 min-w-min">
                  {report.perScreen.map((s, idx) => {
                    const stepId = screenShots.get(s.screenIndex);
                    const screenFindings = findingsByScreen.get(s.screenIndex) ?? [];
                    return (
                      <div key={s.screenIndex} className="flex items-start">
                        <div className="w-52 shrink-0">
                          {/* Step number */}
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[11px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              {idx + 1}
                            </span>
                            <span className="text-xs text-muted-foreground truncate flex-1" title={s.screenLabel}>
                              {s.screenLabel || `Frame ${s.screenIndex + 1}`}
                            </span>
                          </div>

                          {/* Screenshot */}
                          <div
                            className={`rounded-sm overflow-hidden border-2 ${frictionBorder(s.avgFriction)} bg-muted aspect-[16/10] relative group`}
                          >
                            {stepId ? (
                              <img
                                src={`/api/steps/${stepId}/screenshot`}
                                alt={s.screenLabel || `Frame ${s.screenIndex + 1}`}
                                className="w-full h-full object-cover object-top"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Eye className="w-6 h-6 text-muted-foreground/30" />
                              </div>
                            )}
                            {/* Friction overlay */}
                            <div className="absolute top-1.5 right-1.5">
                              <span
                                className={`text-[11px] font-bold px-1.5 py-0.5 rounded bg-background/80 backdrop-blur-sm ${frictionColor(s.avgFriction)}`}
                              >
                                {s.avgFriction.toFixed(2)}
                              </span>
                            </div>
                          </div>

                          {/* Friction bar */}
                          <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full ${frictionBg(s.avgFriction)} rounded-full transition-all`}
                              style={{ width: `${Math.max(s.avgFriction * 100, 3)}%` }}
                            />
                          </div>

                          {/* Stats row */}
                          <div className="flex items-center justify-between mt-1.5 text-[10px]">
                            <div className="flex items-center gap-2">
                              {s.confusionCount > 0 && (
                                <span className="text-amber-400 flex items-center gap-0.5">
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  {s.confusionCount}
                                </span>
                              )}
                              {screenFindings.length > 0 && (
                                <span className="text-red-400 flex items-center gap-0.5">
                                  <Eye className="w-2.5 h-2.5" />
                                  {screenFindings.length}
                                </span>
                              )}
                            </div>
                            <span className={`flex items-center gap-0.5 ${frictionColor(s.avgDropoffRisk)}`}>
                              <TrendingDown className="w-2.5 h-2.5" />
                              {s.avgDropoffRisk.toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {/* Arrow connector */}
                        {idx < report.perScreen!.length - 1 && (
                          <div className="flex items-center px-1 pt-20">
                            <ArrowRight className="w-4 h-4 text-border" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {/* Findings */}
          <section>
            <SectionHeader
              icon={AlertTriangle}
              label={`Findings (${report.findings.length})`}
            />
            {report.findings.length === 0 ? (
              <div className="border border-dashed border-border/50 rounded py-12 text-center">
                <AlertTriangle className="w-6 h-6 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-[15px] text-muted-foreground">No friction issues detected.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {screenIndices.map((screenIdx) => {
                  const screenFindings = findingsByScreen.get(screenIdx) ?? [];
                  const stats = screenStatsMap.get(screenIdx);
                  if (screenFindings.length === 0) return null;

                  return (
                    <div key={screenIdx}>
                      {/* Screen header */}
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          {screenShots.has(screenIdx) && (
                            <div className="w-6 h-4 rounded-sm overflow-hidden border border-border/50 shrink-0">
                              <img
                                src={`/api/steps/${screenShots.get(screenIdx)}/screenshot`}
                                alt=""
                                className="w-full h-full object-cover object-top"
                              />
                            </div>
                          )}
                          <span className="text-sm font-semibold text-foreground">
                            {screenLabels.get(screenIdx) || `Frame ${screenIdx + 1}`}
                          </span>
                        </div>
                        {stats && (
                          <div className="flex items-center gap-3 text-xs">
                            <span className={`flex items-center gap-1 ${frictionColor(stats.avgFriction)}`}>
                              <AlertTriangle className="w-3 h-3" />
                              {stats.avgFriction.toFixed(2)}
                            </span>
                            <span className={`flex items-center gap-1 ${frictionColor(stats.avgDropoffRisk)}`}>
                              <TrendingDown className="w-3 h-3" />
                              {stats.avgDropoffRisk.toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Finding cards */}
                      <div className="space-y-2">
                        {screenFindings.map((f, i) => (
                          <div
                            key={i}
                            className={`border-l-2 ${frictionBorder(f.severity)} bg-card border border-border/40 rounded py-3 px-4`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0 flex-1">
                                <p className="text-[15px] font-medium text-foreground">{f.issue}</p>
                                <p className="text-sm text-muted-foreground mt-1">{f.evidence}</p>
                                {f.recommendedFix && (
                                  <div className="flex items-start gap-1.5 mt-2 text-sm text-primary">
                                    <Lightbulb className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                    <span>{f.recommendedFix}</span>
                                  </div>
                                )}
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {f.affectedPersonas.map((p) => (
                                    <Badge key={p} variant="outline" className="text-[11px] font-normal">
                                      {p}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className={`text-lg font-bold tabular-nums ${frictionColor(f.severity)}`}>
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

          {/* Per-Persona */}
          <section>
            <SectionHeader icon={Users} label="Per-Persona Breakdown" />
            <div className="grid gap-3 md:grid-cols-2">
              {report.perPersona.map((pp) => {
                const episode = run.episodes.find((ep) => ep.persona.id === pp.personaId);
                const isExpanded = expandedPersonas.has(pp.personaId);
                return (
                  <div
                    key={pp.personaId}
                    className="border border-border/50 rounded bg-card overflow-hidden"
                  >
                    {/* Persona header */}
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[15px] font-medium text-foreground">{pp.personaName}</span>
                          {pp.episodeStatus === "ABANDONED" && (
                            <span className="text-[11px] text-amber-400 font-medium">dropped off</span>
                          )}
                        </div>
                        {episode && run.status === "COMPLETED" && (
                          <button
                            onClick={() => setChatEpisode({ id: episode.id, personaName: pp.personaName })}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                          >
                            <MessageCircle className="w-3 h-3" />
                            Chat
                          </button>
                        )}
                      </div>

                      {/* Stat row */}
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <div className="text-xs text-muted-foreground mb-0.5">Friction</div>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-semibold tabular-nums ${frictionColor(pp.avgFriction)}`}>
                              {pp.avgFriction.toFixed(2)}
                            </span>
                            <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full ${frictionBg(pp.avgFriction)} rounded-full`}
                                style={{ width: `${Math.max(pp.avgFriction * 100, 3)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-0.5">Confidence</div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold tabular-nums text-foreground">
                              {pp.avgConfidence.toFixed(2)}
                            </span>
                            <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary/60 rounded-full"
                                style={{ width: `${Math.max(pp.avgConfidence * 100, 3)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-0.5">Steps</div>
                          <span className="text-sm font-semibold text-foreground">{pp.stepsCount}</span>
                        </div>
                      </div>
                    </div>

                    {/* Confusions toggle */}
                    {pp.confusions.length > 0 && (
                      <>
                        <button
                          onClick={() => togglePersonaExpand(pp.personaId)}
                          className="w-full flex items-center justify-between px-4 py-2 border-t border-border/40 text-xs text-muted-foreground hover:bg-muted/30 transition-colors"
                        >
                          <span className="flex items-center gap-1.5">
                            <AlertTriangle className="w-3 h-3 text-amber-400" />
                            {pp.confusions.length} confusion{pp.confusions.length !== 1 ? "s" : ""}
                          </span>
                          <ChevronDown
                            className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          />
                        </button>
                        {isExpanded && (
                          <div className="border-t border-border/40 px-4 py-2 space-y-1.5 bg-muted/20">
                            {pp.confusions.map((c, ci) => (
                              <div key={ci} className="flex items-start gap-2 text-sm">
                                <ChevronRight className="w-3 h-3 text-muted-foreground/50 mt-1 shrink-0" />
                                <div>
                                  <span className="text-muted-foreground/60 text-xs">
                                    {screenLabels.get(c.screenIndex ?? 0) || `Frame ${(c.screenIndex ?? 0) + 1}`}
                                  </span>
                                  <p className="text-foreground/80">{c.issue}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
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
    </div>
  );
}

/* ---------- Shared Components ---------- */

function SectionHeader({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-widest">{label}</h3>
    </div>
  );
}

const statusStyles: Record<string, string> = {
  PENDING: "bg-muted text-muted-foreground",
  RUNNING: "bg-primary/15 text-primary",
  SIMULATING: "bg-primary/15 text-primary",
  AGGREGATING: "bg-primary/15 text-primary",
  COMPLETED: "bg-emerald-400/15 text-emerald-400",
  ABANDONED: "bg-amber-400/15 text-amber-400",
  FAILED: "bg-destructive/15 text-destructive",
};

const statusLabels: Record<string, string> = {
  ABANDONED: "COMPLETED",
};

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

function StatCard({
  label,
  value,
  sub,
  colorClass,
}: {
  label: string;
  value: string | number;
  sub: string;
  colorClass?: string;
}) {
  return (
    <div className="bg-card border border-border/50 rounded p-4">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${colorClass ?? "text-foreground"}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>
    </div>
  );
}
