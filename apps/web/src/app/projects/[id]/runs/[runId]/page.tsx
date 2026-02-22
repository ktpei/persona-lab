"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { PersonaChat } from "@/components/persona-chat";
import { VoiceCall } from "@/components/voice-call";
import {
  AlertTriangle,
  MessageCircle,
  ChevronRight,
  Globe,
  Users,
  BarChart3,
  ChevronDown,
  FileText,
  Phone,
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

interface Report {
  summary: {
    totalEpisodes: number;
    completedEpisodes: number;
    abandonedEpisodes: number;
    avgFriction: number;
    avgDropoffRisk: number;
  };
  findings: Finding[];
  perScreen?: Array<{
    screenIndex: number;
    screenLabel?: string;
    avgFriction: number;
    maxFriction: number;
    avgDropoffRisk: number;
    confusionCount: number;
    findingCount: number;
    totalSteps: number;
  }>;
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

interface StepData {
  stepId: string;
  stepIndex: number;
  screenLabel: string;
  friction: number;
  confidence: number;
  dropoffRisk: number;
  salient?: string;
  action?: string;
  confusions: Array<{ issue: string; evidence: string }>;
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

function frictionChipClass(value: number): string {
  if (value >= 0.6) return "bg-red-400/15 text-red-400 border-red-400/30";
  if (value >= 0.3) return "bg-amber-400/15 text-amber-400 border-amber-400/30";
  return "bg-emerald-400/15 text-emerald-400 border-emerald-400/30";
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
  const [expandedPersonas, setExpandedPersonas] = useState<Set<string>>(new Set());
  const [episodeSteps, setEpisodeSteps] = useState<Map<string, StepData[]>>(new Map());
  const [loadingSteps, setLoadingSteps] = useState<Set<string>>(new Set());
  const [overview, setOverview] = useState<string | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [voiceCallEpisode, setVoiceCallEpisode] = useState<{ id: string; personaName: string } | null>(null);

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
    setOverviewLoading(true);
    fetch(`/api/runs/${runId}/overview`)
      .then((r) => r.json())
      .then((data) => setOverview(data.overview ?? null))
      .catch(() => {})
      .finally(() => setOverviewLoading(false));
  }, [run?.status, runId]);

  async function togglePersonaExpand(personaId: string, episodeId: string) {
    const isCurrentlyExpanded = expandedPersonas.has(personaId);
    setExpandedPersonas((prev) => {
      const next = new Set(prev);
      if (next.has(personaId)) next.delete(personaId);
      else next.add(personaId);
      return next;
    });

    // Lazily load steps on first expand
    if (!isCurrentlyExpanded && !episodeSteps.has(episodeId) && !loadingSteps.has(episodeId)) {
      setLoadingSteps((prev) => new Set(prev).add(episodeId));
      try {
        const res = await fetch(`/api/episodes/${episodeId}/steps`);
        const data = await res.json();
        setEpisodeSteps((prev) => new Map(prev).set(episodeId, data.steps));
      } catch {
        // silently ignore — steps just won't show
      } finally {
        setLoadingSteps((prev) => {
          const next = new Set(prev);
          next.delete(episodeId);
          return next;
        });
      }
    }
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

  const isAgentMode = run.mode === "AGENT";
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

      {/* Live persona grid */}
      {run.status !== "COMPLETED" && run.status !== "FAILED" && (
        <LivePersonaGrid
          episodes={run.episodes}
          runStatus={run.status}
          isAgentMode={isAgentMode}
        />
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
                sub="friction issues identified"
              />
            </div>
          </section>

          {/* AI overview */}
          {(overviewLoading || overview) && (
            <section>
              <SectionHeader icon={FileText} label="Overview" />
              <div className="border border-border/50 rounded bg-card p-4">
                {overviewLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="h-3 w-3 animate-spin rounded-full border border-primary border-r-transparent" />
                    Generating summary...
                  </div>
                ) : (
                  <p className="text-[15px] text-muted-foreground leading-relaxed">{overview}</p>
                )}
              </div>
            </section>
          )}

          {/* Per-Persona */}
          <section>
            <SectionHeader icon={Users} label="Personas" />
            <div className="space-y-3">
              {report.perPersona.map((pp) => {
                const episode = run.episodes.find((ep) => ep.persona.id === pp.personaId);
                const isExpanded = expandedPersonas.has(pp.personaId);
                const steps = episode ? episodeSteps.get(episode.id) : undefined;
                const isLoading = episode ? loadingSteps.has(episode.id) : false;

                return (
                  <div
                    key={pp.personaId}
                    className="border border-border/50 rounded bg-card overflow-hidden"
                  >
                    {/* Persona header */}
                    <div className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0 flex-1 flex-wrap">
                          <span className="text-[15px] font-medium text-foreground shrink-0">{pp.personaName}</span>
                          {pp.episodeStatus === "ABANDONED" && (
                            <span className="text-[11px] text-amber-400 font-medium bg-amber-400/10 px-2 py-0.5 rounded shrink-0">
                              dropped off
                            </span>
                          )}
                          {pp.episodeStatus === "COMPLETED" && (
                            <span className="text-[11px] text-emerald-400 font-medium bg-emerald-400/10 px-2 py-0.5 rounded shrink-0">
                              completed
                            </span>
                          )}
                          {/* Friction bar */}
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-muted-foreground">Friction</span>
                            <div className="w-16 h-1 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full ${frictionBg(pp.avgFriction)} rounded-full`}
                                style={{ width: `${Math.max(pp.avgFriction * 100, 3)}%` }}
                              />
                            </div>
                            <span className={`text-xs font-semibold tabular-nums ${frictionColor(pp.avgFriction)}`}>
                              {pp.avgFriction.toFixed(2)}
                            </span>
                          </div>
                          {/* Confidence bar */}
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-muted-foreground">Conf.</span>
                            <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary/60 rounded-full"
                                style={{ width: `${Math.max(pp.avgConfidence * 100, 3)}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold tabular-nums text-foreground">
                              {pp.avgConfidence.toFixed(2)}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">{pp.stepsCount} steps</span>
                        </div>
                        {/* Chat + Voice buttons */}
                        {episode && run.status === "COMPLETED" && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => setChatEpisode({ id: episode.id, personaName: pp.personaName })}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                            >
                              <MessageCircle className="w-3 h-3" />
                              Chat
                            </button>
                            <button
                              onClick={() => setVoiceCallEpisode({ id: episode.id, personaName: pp.personaName })}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border border-border/60 text-foreground hover:bg-muted/40 transition-colors"
                            >
                              <Phone className="w-3 h-3" />
                              Voice
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Toggle button */}
                    <button
                      onClick={() => episode && togglePersonaExpand(pp.personaId, episode.id)}
                      className="w-full flex items-center justify-between px-4 py-2 border-t border-border/40 text-xs text-muted-foreground hover:bg-muted/30 transition-colors"
                    >
                      <span>{isExpanded ? "Hide" : "Show"} journey ({pp.stepsCount} steps)</span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      />
                    </button>

                    {/* Expanded steps */}
                    {isExpanded && (
                      <div className="border-t border-border/40 bg-muted/10">
                        {isLoading ? (
                          <div className="flex items-center justify-center py-6">
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-r-transparent" />
                            <span className="ml-2 text-xs text-muted-foreground">Loading steps...</span>
                          </div>
                        ) : steps && steps.length > 0 ? (
                          <div className="divide-y divide-border/30">
                            {steps.map((step) => (
                              <div key={step.stepIndex} className="px-4 py-3">
                                <div className="flex items-start gap-3">
                                  {/* Step number */}
                                  <span className="text-[11px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0 mt-0.5 tabular-nums">
                                    {step.stepIndex + 1}
                                  </span>
                                  {/* Screenshot */}
                                  <div className="w-24 h-16 shrink-0 rounded overflow-hidden border border-border/40 bg-muted">
                                    <img
                                      src={`/api/steps/${step.stepId}/screenshot`}
                                      alt={step.screenLabel}
                                      className="w-full h-full object-cover object-top"
                                      loading="lazy"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = "none";
                                      }}
                                    />
                                  </div>
                                  {/* Content */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-xs text-foreground/70 truncate">{step.screenLabel}</span>
                                      <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded border ${frictionChipClass(step.friction)} shrink-0`}>
                                        {step.friction.toFixed(2)}
                                      </span>
                                    </div>
                                    {step.salient && (
                                      <p className="text-xs text-muted-foreground line-clamp-2">{step.salient}</p>
                                    )}
                                    {step.confusions.length > 0 && (
                                      <div className="mt-1.5 space-y-0.5">
                                        {step.confusions.map((c, ci) => (
                                          <div key={ci} className="flex items-start gap-1.5">
                                            <ChevronRight className="w-3 h-3 text-amber-400/60 mt-0.5 shrink-0" />
                                            <span className="text-[11px] text-amber-400/80">{c.issue}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="py-4 text-center text-xs text-muted-foreground">No step data available.</div>
                        )}
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

      {voiceCallEpisode && (
        <VoiceCall
          episodeId={voiceCallEpisode.id}
          personaName={voiceCallEpisode.personaName}
          onClose={() => setVoiceCallEpisode(null)}
        />
      )}
    </div>
  );
}

/* ---------- Live Persona Grid ---------- */

const MAX_VISIBLE = 9;
const TERMINAL = new Set(["COMPLETED", "ABANDONED", "FAILED"]);

function getGridCols(count: number): number {
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count === 3) return 3;
  if (count === 4) return 2; // 2×2
  return 3;                  // 5–9: 3-col
}

function LivePersonaGrid({
  episodes,
  runStatus,
  isAgentMode,
}: {
  episodes: Episode[];
  runStatus: string;
  isAgentMode: boolean;
}) {
  const [showMore, setShowMore] = useState(false);

  const visible = episodes.slice(0, MAX_VISIBLE);
  const overflow = episodes.slice(MAX_VISIBLE);

  const cols = getGridCols(visible.length);
  const gridClass = [
    "grid gap-2",
    cols === 1 ? "grid-cols-1 max-w-3xl mx-auto" : cols === 2 ? "grid-cols-2" : "grid-cols-3",
  ].join(" ");

  const doneCount = episodes.filter((e) => TERMINAL.has(e.status)).length;
  const isAggregating = runStatus === "AGGREGATING";

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center gap-2">
        {isAggregating ? (
          <>
            <div className="h-2.5 w-2.5 animate-spin rounded-full border border-primary border-r-transparent" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Generating Report</span>
          </>
        ) : (
          <>
            <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Live</span>
          </>
        )}
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {doneCount} / {episodes.length} done
        </span>
      </div>

      {/* Main grid */}
      <div className={gridClass}>
        {visible.map((ep) => (
          <LivePersonaCell key={ep.id} episode={ep} isAgentMode={isAgentMode} />
        ))}
      </div>

      {/* Overflow bar */}
      {overflow.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setShowMore((s) => !s)}
            className="w-full flex items-center justify-between px-4 py-2.5 border border-border/50 rounded bg-card text-xs text-muted-foreground hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showMore ? "rotate-180" : ""}`} />
              <span>
                {overflow.length} more persona{overflow.length !== 1 ? "s" : ""}
              </span>
            </div>
            <span>
              {overflow.filter((e) => e.status === "RUNNING").length} running
            </span>
          </button>
          {showMore && (
            <div className="grid grid-cols-3 gap-2">
              {overflow.map((ep) => (
                <LivePersonaCell key={ep.id} episode={ep} isAgentMode={isAgentMode} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LivePersonaCell({
  episode,
  isAgentMode,
}: {
  episode: Episode;
  isAgentMode: boolean;
}) {
  const isDone = TERMINAL.has(episode.status);
  const [timestamp, setTimestamp] = useState(() => Date.now());
  const [hasImage, setHasImage] = useState(false);

  useEffect(() => {
    if (isDone || !isAgentMode) return;
    const interval = setInterval(() => setTimestamp(Date.now()), 1500);
    return () => clearInterval(interval);
  }, [isDone, isAgentMode]);

  const dotClass =
    episode.status === "RUNNING"
      ? "bg-primary animate-pulse"
      : episode.status === "COMPLETED" || episode.status === "ABANDONED"
        ? "bg-emerald-400"
        : episode.status === "FAILED"
          ? "bg-red-400"
          : "bg-muted-foreground/30";

  const statusLabel =
    episode.status === "COMPLETED" ? "completed" :
    episode.status === "ABANDONED" ? "dropped off" :
    episode.status === "FAILED" ? "failed" :
    episode.status === "RUNNING" ? "running" : "pending";

  return (
    <div className="relative rounded overflow-hidden bg-[#0d0d0d] border border-border/30" style={{ aspectRatio: "16/10" }}>
      {/* Live screenshot */}
      {isAgentMode && (
        <img
          src={`/api/episodes/${episode.id}/latest-screenshot?t=${timestamp}`}
          alt={episode.persona.name}
          className={`absolute inset-0 w-full h-full object-cover object-top transition-opacity duration-500 ${hasImage ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setHasImage(true)}
          onError={() => setHasImage(false)}
        />
      )}

      {/* Placeholder while waiting for first screenshot */}
      {!hasImage && (
        <div className="absolute inset-0 flex items-center justify-center">
          {episode.status === "RUNNING" ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/40 border-r-transparent" />
          ) : episode.status === "PENDING" ? (
            <div className="h-3 w-3 rounded-full bg-muted-foreground/20" />
          ) : null}
        </div>
      )}

      {/* Dim overlay when done */}
      {isDone && hasImage && (
        <div className="absolute inset-0 bg-black/40" />
      )}

      {/* Bottom name bar */}
      <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/85 via-black/40 to-transparent">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium text-white leading-none truncate pr-2">
            {episode.persona.name}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] text-white/50 tabular-nums">{episode._count.steps} steps</span>
            <div className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
          </div>
        </div>
        {isDone && (
          <p className="text-[11px] text-white/40 mt-0.5">{statusLabel}</p>
        )}
      </div>
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
