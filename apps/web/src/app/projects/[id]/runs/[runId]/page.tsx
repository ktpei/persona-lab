"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PersonaChat } from "@/components/persona-chat";
import { VoiceCall } from "@/components/voice-call";
import { FocusGroupTab } from "@/components/focus-group-tab";
import {
  frictionColor,
  frictionBg,
  frictionChipClass,
  severityLabel,
  severityBorderClass,
} from "@/lib/friction-utils";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  MessageCircle,
  ChevronRight,
  Globe,
  Users,
  ChevronDown,
  Phone,
  Sparkles,
  RefreshCw,
  Loader2,
  Activity,
  CheckCircle2,
  X,
  Brain,
  Square,
} from "lucide-react";

/* ---------- Types ---------- */

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

interface DbFinding {
  id: string;
  issue: string;
  evidence: string;
  severity: number;
  frequency: number;
  affectedPersonas: string[];
  elementRef?: string | null;
  stepIndex?: number | null;
  screenUrl?: string | null;
  recommendedFix?: string | null;
}

interface Report {
  summary: {
    totalEpisodes: number;
    completedEpisodes: number;
    abandonedEpisodes: number;
    avgFriction: number;
    avgDropoffRisk: number;
  };
  findings: Array<{
    issue: string;
    evidence: string;
    severity: number;
    frequency: number;
    affectedPersonas: string[];
    elementRef?: string;
    stepIndex?: number;
    screenIndex?: number;
    recommendedFix?: string;
  }>;
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

interface ThoughtData {
  stepIndex: number;
  salient: string | null;
  action: string | null;
  friction: number;
  pageTitle: string | null;
}

/* ---------- Main Component ---------- */

export default function RunDetail() {
  const params = useParams<{ id: string; runId: string }>();
  const { runId } = params;
  const [run, setRun] = useState<Run | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [dbFindings, setDbFindings] = useState<DbFinding[]>([]);
  const [chatEpisode, setChatEpisode] = useState<{ id: string; personaName: string } | null>(null);
  const [expandedPersonas, setExpandedPersonas] = useState<Set<string>>(new Set());
  const [episodeSteps, setEpisodeSteps] = useState<Map<string, StepData[]>>(new Map());
  const [loadingSteps, setLoadingSteps] = useState<Set<string>>(new Set());
  const [overview, setOverview] = useState<string | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [voiceCallEpisode, setVoiceCallEpisode] = useState<{ id: string; personaName: string } | null>(null);
  const [generatingFixIds, setGeneratingFixIds] = useState<Set<string>>(new Set());
  const [showAllFindings, setShowAllFindings] = useState(false);
  const [expandedFindings, setExpandedFindings] = useState<Set<string>>(new Set());
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [screenMap, setScreenMap] = useState<Map<number, { stepId: string; screenLabel?: string }>>(new Map());

  const loadRun = useCallback(() => {
    fetch(`/api/runs/${runId}`)
      .then((r) => r.json())
      .then(setRun);
  }, [runId]);

  useEffect(() => {
    loadRun();
  }, [loadRun]);

  useEffect(() => {
    if (!run || run.status === "COMPLETED" || run.status === "FAILED" || run.status === "CANCELLED") return;
    const interval = setInterval(loadRun, 3000);
    return () => clearInterval(interval);
  }, [run?.status, loadRun]);

  useEffect(() => {
    if (run?.status !== "COMPLETED") return;
    fetch(`/api/runs/${runId}/report`)
      .then((r) => r.json())
      .then((data) => {
        setReport(data.report);
        if (data.findings) setDbFindings(data.findings);
      });
    setOverviewLoading(true);
    fetch(`/api/runs/${runId}/overview`)
      .then((r) => r.json())
      .then((data) => setOverview(data.overview ?? null))
      .catch(() => {})
      .finally(() => setOverviewLoading(false));
    fetch(`/api/runs/${runId}/screenshots`)
      .then((r) => r.json())
      .then((data) => {
        const map = new Map<number, { stepId: string; screenLabel?: string }>();
        for (const s of data.screens ?? []) map.set(s.screenIndex, { stepId: s.stepId, screenLabel: s.screenLabel });
        setScreenMap(map);
      })
      .catch(() => {});
  }, [run?.status, runId]);

  async function togglePersonaExpand(personaId: string, episodeId: string) {
    const isCurrentlyExpanded = expandedPersonas.has(personaId);
    setExpandedPersonas((prev) => {
      const next = new Set(prev);
      if (next.has(personaId)) next.delete(personaId);
      else next.add(personaId);
      return next;
    });

    if (!isCurrentlyExpanded && !episodeSteps.has(episodeId) && !loadingSteps.has(episodeId)) {
      setLoadingSteps((prev) => new Set(prev).add(episodeId));
      try {
        const res = await fetch(`/api/episodes/${episodeId}/steps`);
        const data = await res.json();
        setEpisodeSteps((prev) => new Map(prev).set(episodeId, data.steps));
      } catch {
        // silently ignore
      } finally {
        setLoadingSteps((prev) => {
          const next = new Set(prev);
          next.delete(episodeId);
          return next;
        });
      }
    }
  }

  async function generateFix(findingId: string, regenerate = false) {
    setGeneratingFixIds((prev) => new Set(prev).add(findingId));
    try {
      const res = await fetch(`/api/findings/${findingId}/fix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerate }),
      });
      const data = await res.json();
      if (data.fix) {
        setDbFindings((prev) =>
          prev.map((f) => (f.id === findingId ? { ...f, recommendedFix: data.fix } : f))
        );
        setExpandedFindings((prev) => new Set(prev).add(findingId));
      }
    } catch {
      // silently ignore
    } finally {
      setGeneratingFixIds((prev) => {
        const next = new Set(prev);
        next.delete(findingId);
        return next;
      });
    }
  }

  async function handleCancel() {
    setCancelling(true);
    try {
      await fetch(`/api/runs/${runId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      loadRun();
    } finally {
      setCancelling(false);
    }
  }

  function toggleFindingExpand(id: string) {
    setExpandedFindings((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /* ---------- Loading skeleton ---------- */

  if (!run) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-muted rounded w-48" />
        <div className="grid grid-cols-4 gap-3 mt-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-muted rounded" />
          ))}
        </div>
        <div className="h-20 bg-muted rounded" />
        <div className="grid grid-cols-[3fr_2fr] gap-6">
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded" />
            ))}
          </div>
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-14 bg-muted rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const isAgentMode = run.mode === "AGENT";
  const completionRate = report
    ? Math.round((report.summary.completedEpisodes / report.summary.totalEpisodes) * 100)
    : 0;

  const displayFindings = dbFindings.length > 0
    ? dbFindings
    : (report?.findings ?? []).map((f, i) => ({
        ...f,
        id: `report-${i}`,
        elementRef: f.elementRef ?? null,
        stepIndex: f.stepIndex ?? null,
        screenUrl: null,
        recommendedFix: f.recommendedFix ?? null,
      }));

  // Build lookup: screenUrl → screenshot stepId for finding thumbnails
  const screenUrlToStepId = new Map<string, string>();
  for (const [, entry] of screenMap) {
    if (entry.screenLabel) screenUrlToStepId.set(entry.screenLabel, entry.stepId);
  }

  function findingScreenshot(finding: (typeof displayFindings)[number]): string | null {
    // Try matching screenUrl against the screenshots map
    if (finding.screenUrl) {
      const stepId = screenUrlToStepId.get(finding.screenUrl);
      if (stepId) return `/api/steps/${stepId}/screenshot`;
    }
    // For report-based findings with screenIndex, use screenMap directly
    const reportFinding = report?.findings?.find((f) => f.issue === finding.issue);
    if (reportFinding?.screenIndex != null) {
      const entry = screenMap.get(reportFinding.screenIndex);
      if (entry) return `/api/steps/${entry.stepId}/screenshot`;
    }
    return null;
  }

  function findingScreenLabel(finding: (typeof displayFindings)[number]): string | null {
    if (finding.screenUrl) return finding.screenUrl;
    const reportFinding = report?.findings?.find((f) => f.issue === finding.issue);
    if (reportFinding?.screenIndex != null) {
      const entry = screenMap.get(reportFinding.screenIndex);
      if (entry?.screenLabel) return entry.screenLabel;
    }
    return null;
  }
  const visibleFindings = showAllFindings ? displayFindings : displayFindings.slice(0, 6);
  const hiddenFindingsCount = displayFindings.length - 6;

  const highCount = displayFindings.filter((f) => f.severity >= 0.6).length;
  const medCount = displayFindings.filter((f) => f.severity >= 0.3 && f.severity < 0.6).length;
  const lowCount = displayFindings.filter((f) => f.severity < 0.3).length;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-bold text-foreground tracking-tight font-mono">
              {run.id.slice(0, 8)}
            </h2>
            <StatusPill status={run.status} />
            {isAgentMode && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <Globe className="w-2.5 h-2.5" />
                Agent
              </Badge>
            )}
          </div>
          <span className="text-[12px] text-muted-foreground/50 font-mono">
            {new Date(run.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        {!["COMPLETED", "FAILED", "CANCELLED"].includes(run.status) && (
          <Button variant="outline" size="sm" onClick={handleCancel} disabled={cancelling}>
            <Square className="w-3 h-3 mr-1.5" />
            {cancelling ? "Cancelling..." : "Cancel Run"}
          </Button>
        )}
      </div>

      {/* ── Live persona grid ── */}
      {run.status !== "COMPLETED" && run.status !== "FAILED" && run.status !== "CANCELLED" && (
        <LivePersonaGrid
          episodes={run.episodes}
          runStatus={run.status}
          isAgentMode={isAgentMode}
        />
      )}

      {/* ── Report + Focus Group ── */}
      {report && (
        <Tabs defaultValue="report">
          <TabsList>
            <TabsTrigger value="report">Report</TabsTrigger>
            <TabsTrigger value="focus-group">Focus Group</TabsTrigger>
          </TabsList>

          <TabsContent value="report">
            <div className="space-y-6">
              {/* ── KPI stat boxes ── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatBox
                  icon={Users}
                  value={report.summary.totalEpisodes}
                  label="Personas"
                  detail={`${report.summary.completedEpisodes} completed`}
                />
                <StatBox
                  icon={CheckCircle2}
                  value={`${completionRate}%`}
                  label="Completion"
                  detail={report.summary.abandonedEpisodes > 0 ? `${report.summary.abandonedEpisodes} dropped off` : "all finished"}
                  valueClass={completionRate >= 80 ? "text-emerald-400" : completionRate >= 50 ? "text-amber-400" : "text-red-400"}
                />
                <StatBox
                  icon={Activity}
                  value={report.summary.avgFriction.toFixed(2)}
                  label="Avg Friction"
                  detail={severityLabel(report.summary.avgFriction)}
                  valueClass={frictionColor(report.summary.avgFriction)}
                />
                <StatBox
                  icon={AlertTriangle}
                  value={displayFindings.length}
                  label="Findings"
                  detail={highCount > 0 ? `${highCount} high severity` : `${medCount} medium`}
                  valueClass={highCount > 0 ? "text-red-400" : medCount > 0 ? "text-amber-400" : "text-emerald-400"}
                />
              </div>

              {/* ── AI overview callout ── */}
              {(overviewLoading || overview) && (
                <div className="border-l-4 border-primary bg-primary/5 rounded p-5">
                  {overviewLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      Generating analysis...
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <p className="text-[15px] text-foreground leading-relaxed">{overview}</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Journey flow filmstrip ── */}
              {report.perScreen && report.perScreen.length > 0 && screenMap.size > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                      Journey Flow
                    </h3>
                    <span className="text-[10px] text-muted-foreground/50">{report.perScreen.length} screens</span>
                  </div>
                  <div className="overflow-x-auto pb-2 -mx-1 px-1">
                    <div className="flex items-stretch gap-0 min-w-min">
                      {report.perScreen.map((screen, i) => {
                        const entry = screenMap.get(screen.screenIndex);
                        const screenshotSrc = entry ? `/api/steps/${entry.stepId}/screenshot` : null;
                        const label = screen.screenLabel || entry?.screenLabel || `Screen ${screen.screenIndex + 1}`;
                        const shortLabel = label.length > 24 ? label.slice(0, 21) + "..." : label;

                        return (
                          <div key={screen.screenIndex} className="flex items-center">
                            <div className="flex flex-col items-center w-[140px] shrink-0">
                              {screenshotSrc ? (
                                <button
                                  onClick={() => setLightboxSrc(screenshotSrc)}
                                  className="w-[130px] h-[82px] rounded border border-border/40 bg-muted overflow-hidden hover:border-primary/50 transition-all cursor-zoom-in"
                                >
                                  <img
                                    src={screenshotSrc}
                                    alt={label}
                                    className="w-full h-full object-cover object-top"
                                    loading="lazy"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                  />
                                </button>
                              ) : (
                                <div className="w-[130px] h-[82px] rounded border border-dashed border-border/40 bg-muted/30 flex items-center justify-center">
                                  <Globe className="w-5 h-5 text-muted-foreground/30" />
                                </div>
                              )}
                              <div className="mt-1.5 text-center w-full px-1">
                                <span className="text-[10px] text-muted-foreground/70 font-mono block truncate" title={label}>
                                  {shortLabel}
                                </span>
                                <div className="flex items-center justify-center gap-2 mt-1">
                                  <span className={`text-[11px] font-semibold tabular-nums ${frictionColor(screen.avgFriction)}`}>
                                    {screen.avgFriction.toFixed(2)}
                                  </span>
                                  {screen.findingCount > 0 && (
                                    <span className="text-[10px] text-amber-400/70">
                                      {screen.findingCount} {screen.findingCount === 1 ? "issue" : "issues"}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {i < report.perScreen!.length - 1 && (
                              <ChevronRight className="w-4 h-4 text-muted-foreground/30 shrink-0 -mx-1" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              )}

              {/* ── Two-column: Findings (primary) | Personas (supporting) ── */}
              <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6">
                {/* ── LEFT: Findings (primary content) ── */}
                <section className="min-w-0">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground" />
                      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                        Findings
                      </h3>
                    </div>
                    {displayFindings.length > 0 && (
                      <div className="flex items-center gap-2">
                        {highCount > 0 && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-400/10 text-red-400">
                            {highCount} high
                          </span>
                        )}
                        {medCount > 0 && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-400">
                            {medCount} med
                          </span>
                        )}
                        {lowCount > 0 && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-400/10 text-emerald-400">
                            {lowCount} low
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="max-h-[calc(100vh-380px)] overflow-y-auto space-y-2 pr-1">
                    {displayFindings.length === 0 ? (
                      <div className="border border-dashed border-border/50 rounded p-8 text-center text-sm text-muted-foreground">
                        No friction issues detected
                      </div>
                    ) : (
                      <>
                        {visibleFindings.map((finding, idx) => {
                          const isGenerating = generatingFixIds.has(finding.id);
                          const hasDbId = !finding.id.startsWith("report-");
                          const isExpanded = expandedFindings.has(finding.id);
                          const hasFix = !!finding.recommendedFix;
                          const screenshotUrl = findingScreenshot(finding);
                          const screenLabel = findingScreenLabel(finding);

                          return (
                            <div
                              key={finding.id}
                              className={`border border-border/50 border-l-[3px] ${severityBorderClass(finding.severity)} rounded bg-card overflow-hidden transition-colors`}
                            >
                              <button
                                onClick={() => toggleFindingExpand(finding.id)}
                                className="w-full text-left p-4 hover:bg-muted/20 transition-colors"
                              >
                                <div className="flex items-start gap-3">
                                  {screenshotUrl ? (
                                    <div
                                      className="w-16 h-11 shrink-0 rounded overflow-hidden border border-border/30 bg-muted hover:border-primary/50 hover:opacity-90 transition-all cursor-zoom-in mt-0.5"
                                      onClick={(e) => { e.stopPropagation(); setLightboxSrc(screenshotUrl); }}
                                    >
                                      <img
                                        src={screenshotUrl}
                                        alt={screenLabel || "Screen"}
                                        className="w-full h-full object-cover object-top"
                                        loading="lazy"
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                      />
                                    </div>
                                  ) : (
                                    <span className="text-xs font-semibold text-muted-foreground/50 tabular-nums mt-0.5 w-4 shrink-0 text-right">
                                      {idx + 1}
                                    </span>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-3">
                                      <span className="text-[15px] font-medium text-foreground leading-snug">
                                        {finding.issue}
                                      </span>
                                      <div className="flex items-center gap-2 shrink-0 mt-0.5">
                                        <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded border ${frictionChipClass(finding.severity)}`}>
                                          {severityLabel(finding.severity)}
                                        </span>
                                        <span className="text-[11px] text-muted-foreground tabular-nums">
                                          {finding.frequency}x
                                        </span>
                                        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground/50 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                                      </div>
                                    </div>
                                    {screenLabel && (
                                      <div className="flex items-center gap-1.5 mt-1.5">
                                        <Globe className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                                        <span className="text-[11px] text-muted-foreground/70 font-mono truncate">{screenLabel}</span>
                                      </div>
                                    )}
                                    {finding.affectedPersonas.length > 0 && (
                                      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                                        <Users className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                                        {(finding.affectedPersonas as string[]).map((name) => (
                                          <span
                                            key={name}
                                            className="text-[10px] px-1.5 py-0.5 rounded bg-muted/80 text-muted-foreground"
                                          >
                                            {name}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </button>

                              {isExpanded && (
                                <div className="border-t border-border/30 px-4 pb-4 pt-3 ml-7">
                                  <div className="mb-3">
                                    <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-widest">
                                      Evidence
                                    </span>
                                    <p className="text-[13px] text-muted-foreground leading-relaxed mt-1">
                                      {finding.evidence}
                                    </p>
                                  </div>
                                  {finding.elementRef && (
                                    <div className="mb-3">
                                      <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-widest">
                                        Element
                                      </span>
                                      <p className="text-xs text-foreground/60 font-mono mt-1">{finding.elementRef}</p>
                                    </div>
                                  )}
                                  {hasFix ? (
                                    <div className="bg-primary/5 border border-primary/10 rounded p-3">
                                      <div className="flex items-center justify-between mb-1.5">
                                        <div className="flex items-center gap-1.5">
                                          <Sparkles className="w-3 h-3 text-primary" />
                                          <span className="text-[10px] font-medium text-primary uppercase tracking-widest">
                                            Recommended Fix
                                          </span>
                                        </div>
                                        {hasDbId && (
                                          <button
                                            onClick={(e) => { e.stopPropagation(); generateFix(finding.id, true); }}
                                            disabled={isGenerating}
                                            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                                          >
                                            <RefreshCw className={`w-3 h-3 ${isGenerating ? "animate-spin" : ""}`} />
                                            Regenerate
                                          </button>
                                        )}
                                      </div>
                                      <p className="text-[13px] text-foreground/80 leading-relaxed">
                                        {finding.recommendedFix}
                                      </p>
                                    </div>
                                  ) : hasDbId ? (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); generateFix(finding.id); }}
                                      disabled={isGenerating}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                                    >
                                      {isGenerating ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      ) : (
                                        <Sparkles className="w-3.5 h-3.5" />
                                      )}
                                      {isGenerating ? "Generating fix..." : "Generate Fix"}
                                    </button>
                                  ) : null}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {hiddenFindingsCount > 0 && (
                          <button
                            onClick={() => setShowAllFindings((v) => !v)}
                            className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors border border-border/30 rounded hover:bg-muted/20"
                          >
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAllFindings ? "rotate-180" : ""}`} />
                            {showAllFindings ? "Show less" : `Show ${hiddenFindingsCount} more finding${hiddenFindingsCount !== 1 ? "s" : ""}`}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </section>

                {/* ── RIGHT: Personas (supporting context) ── */}
                <section className="min-w-0">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                      Personas
                    </h3>
                    <span className="text-[10px] text-muted-foreground/50 ml-auto tabular-nums">
                      {report.perPersona.length} total
                    </span>
                  </div>

                  <div className="max-h-[calc(100vh-380px)] overflow-y-auto space-y-2 pr-1">
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
                          <div className="p-3">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span className="text-[13px] font-medium text-foreground truncate">
                                  {pp.personaName}
                                </span>
                                {pp.episodeStatus === "ABANDONED" && (
                                  <span className="text-[10px] text-amber-400 font-medium bg-amber-400/10 px-1.5 py-0.5 rounded shrink-0">
                                    dropped
                                  </span>
                                )}
                                {pp.episodeStatus === "COMPLETED" && (
                                  <span className="text-[10px] text-emerald-400 font-medium bg-emerald-400/10 px-1.5 py-0.5 rounded shrink-0">
                                    done
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
                                    <div
                                      className={`h-full ${frictionBg(pp.avgFriction)} rounded-full`}
                                      style={{ width: `${Math.max(pp.avgFriction * 100, 3)}%` }}
                                    />
                                  </div>
                                  <span className={`text-[11px] font-semibold tabular-nums ${frictionColor(pp.avgFriction)}`}>
                                    {pp.avgFriction.toFixed(2)}
                                  </span>
                                </div>
                                {episode && run.status === "COMPLETED" && (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => setChatEpisode({ id: episode.id, personaName: pp.personaName })}
                                      className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                      title="Chat"
                                    >
                                      <MessageCircle className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => setVoiceCallEpisode({ id: episode.id, personaName: pp.personaName })}
                                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                                      title="Voice"
                                    >
                                      <Phone className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 mt-1.5">
                              <span className="text-[10px] text-muted-foreground/60">
                                Conf. {pp.avgConfidence.toFixed(2)}
                              </span>
                              <span className="text-[10px] text-muted-foreground/60">
                                {pp.stepsCount} steps
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => episode && togglePersonaExpand(pp.personaId, episode.id)}
                            className="w-full flex items-center justify-between px-3 py-1.5 border-t border-border/30 text-[11px] text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/20 transition-colors"
                          >
                            <span>{isExpanded ? "Hide" : "Show"} journey</span>
                            <ChevronDown
                              className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                            />
                          </button>

                          {/* Expanded steps with clickable screenshots */}
                          {isExpanded && (
                            <div className="border-t border-border/30 bg-muted/10">
                              {isLoading ? (
                                <div className="flex items-center justify-center py-5">
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                                  <span className="ml-2 text-[11px] text-muted-foreground">Loading...</span>
                                </div>
                              ) : steps && steps.length > 0 ? (
                                <div className="divide-y divide-border/20">
                                  {steps.map((step) => (
                                    <div key={step.stepIndex} className="px-3 py-2.5">
                                      <div className="flex items-start gap-2.5">
                                        <span className="text-[10px] font-medium text-muted-foreground/50 bg-muted px-1 py-0.5 rounded shrink-0 mt-0.5 tabular-nums">
                                          {step.stepIndex + 1}
                                        </span>
                                        {/* Clickable screenshot thumbnail */}
                                        <button
                                          onClick={() => setLightboxSrc(`/api/steps/${step.stepId}/screenshot`)}
                                          className="w-20 h-14 shrink-0 rounded overflow-hidden border border-border/30 bg-muted hover:border-primary/50 hover:opacity-90 transition-all cursor-zoom-in"
                                        >
                                          <img
                                            src={`/api/steps/${step.stepId}/screenshot`}
                                            alt={step.screenLabel}
                                            className="w-full h-full object-cover object-top"
                                            loading="lazy"
                                            onError={(e) => {
                                              (e.target as HTMLImageElement).style.display = "none";
                                            }}
                                          />
                                        </button>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 mb-0.5">
                                            <span className="text-[11px] text-foreground/70 truncate">{step.screenLabel}</span>
                                            <span className={`text-[10px] font-semibold px-1 py-0.5 rounded border ${frictionChipClass(step.friction)} shrink-0`}>
                                              {step.friction.toFixed(2)}
                                            </span>
                                          </div>
                                          {step.salient && (
                                            <p className="text-[11px] text-muted-foreground line-clamp-2">{step.salient}</p>
                                          )}
                                          {step.confusions.length > 0 && (
                                            <div className="mt-1 space-y-0.5">
                                              {step.confusions.map((c, ci) => (
                                                <div key={ci} className="flex items-start gap-1">
                                                  <ChevronRight className="w-2.5 h-2.5 text-amber-400/60 mt-0.5 shrink-0" />
                                                  <span className="text-[10px] text-amber-400/80">{c.issue}</span>
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
                                <div className="py-4 text-center text-[11px] text-muted-foreground">No step data.</div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="focus-group">
            <FocusGroupTab
              runId={run.id}
              participants={run.episodes.map((ep) => ({
                personaId: ep.persona.id,
                name: ep.persona.name,
              }))}
            />
          </TabsContent>
        </Tabs>
      )}

      {/* ── Screenshot lightbox ── */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            onClick={() => setLightboxSrc(null)}
            className="absolute top-4 right-4 p-2 rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={lightboxSrc}
            alt="Screenshot"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded border border-border/20"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
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
const TERMINAL = new Set(["COMPLETED", "ABANDONED", "FAILED", "CANCELLED"]);

function getGridCols(count: number): number {
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count === 3) return 3;
  if (count === 4) return 2;
  return 3;
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

  // Sort by persona name so cells don't jump around between polls
  const sorted = [...episodes].sort((a, b) => a.persona.name.localeCompare(b.persona.name));
  const visible = sorted.slice(0, MAX_VISIBLE);
  const overflow = sorted.slice(MAX_VISIBLE);

  const cols = getGridCols(visible.length);
  const gridClass = [
    "grid gap-2",
    cols === 1 ? "grid-cols-1 max-w-3xl mx-auto" : cols === 2 ? "grid-cols-2" : "grid-cols-3",
  ].join(" ");

  const doneCount = episodes.filter((e) => TERMINAL.has(e.status)).length;
  const isAggregating = runStatus === "AGGREGATING";

  return (
    <div className="space-y-3">
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

      <div className={gridClass}>
        {visible.map((ep) => (
          <LivePersonaCell key={ep.id} episode={ep} isAgentMode={isAgentMode} />
        ))}
      </div>

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
  const isRunning = episode.status === "RUNNING";
  const [timestamp, setTimestamp] = useState(() => Date.now());
  const [hasImage, setHasImage] = useState(false);
  const [thought, setThought] = useState<ThoughtData | null>(null);

  // Poll screenshot
  useEffect(() => {
    if (isDone || !isAgentMode) return;
    const interval = setInterval(() => setTimestamp(Date.now()), 1500);
    return () => clearInterval(interval);
  }, [isDone, isAgentMode]);

  // Poll latest thought
  useEffect(() => {
    if (!isRunning) return;

    let cancelled = false;
    const poll = () => {
      fetch(`/api/episodes/${episode.id}/latest-thought`)
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled && data.thought) setThought(data.thought);
        })
        .catch(() => {});
    };

    poll();
    const interval = setInterval(poll, 2000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [episode.id, isRunning]);

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
    episode.status === "CANCELLED" ? "cancelled" :
    episode.status === "RUNNING" ? "running" : "pending";

  // Map action enum to human-readable label
  const actionLabel = thought?.action
    ? ({
        CLICK_PRIMARY_CTA: "Clicking primary CTA",
        CLICK_SECONDARY_CTA: "Clicking secondary CTA",
        OPEN_NAV: "Opening navigation",
        SCROLL: "Scrolling",
        BACK: "Going back",
        SEEK_INFO: "Looking for information",
        HESITATE: "Hesitating...",
        ABANDON: "Abandoning",
      } as Record<string, string>)[thought.action] ?? thought.action.toLowerCase().replace(/_/g, " ")
    : null;

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

      {/* Placeholder */}
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

      {/* ── Thought bubble (top) ── */}
      {isRunning && thought?.salient && (
        <div className="absolute top-0 left-0 right-0 px-2.5 pt-2 pb-6 bg-gradient-to-b from-black/80 via-black/50 to-transparent">
          <div className="flex items-start gap-1.5">
            <Brain className="w-3 h-3 text-primary/80 mt-0.5 shrink-0" />
            <p className="text-[10px] text-white/80 leading-tight line-clamp-2">
              {thought.salient}
            </p>
          </div>
          {actionLabel && (
            <span className="inline-block mt-1 ml-4.5 text-[9px] text-primary/70 font-medium uppercase tracking-wider">
              {actionLabel}
            </span>
          )}
        </div>
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

function StatBox({
  icon: Icon,
  value,
  label,
  detail,
  valueClass,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string | number;
  label: string;
  detail: string;
  valueClass?: string;
}) {
  return (
    <div className="border border-border/40 rounded bg-card p-3.5">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="w-3 h-3 text-muted-foreground/40" />
        <span className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-widest">{label}</span>
      </div>
      <div className={`text-xl font-bold tabular-nums font-mono ${valueClass ?? "text-foreground"}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground/60 mt-1">{detail}</div>
    </div>
  );
}

const statusStyles: Record<string, string> = {
  PENDING: "bg-muted text-muted-foreground",
  RUNNING: "bg-primary/10 text-primary",
  SIMULATING: "bg-primary/10 text-primary",
  AGGREGATING: "bg-primary/10 text-primary",
  COMPLETED: "bg-emerald-500/10 text-emerald-500",
  ABANDONED: "bg-amber-400/10 text-amber-400",
  FAILED: "bg-destructive/10 text-destructive",
  CANCELLED: "bg-amber-400/10 text-amber-400",
};

const statusLabels: Record<string, string> = {
  ABANDONED: "COMPLETED",
};

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-px text-[10px] font-medium tracking-wider uppercase ${
        statusStyles[status] ?? "bg-muted text-muted-foreground"
      }`}
    >
      {statusLabels[status] ?? status}
    </span>
  );
}
