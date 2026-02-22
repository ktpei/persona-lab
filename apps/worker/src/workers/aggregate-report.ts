import { prisma } from "../lib/prisma.js";
import { createLLMProvider } from "../lib/llm/openrouter-provider.js";
import type { AggregateReportJob } from "@persona-lab/shared";
import type { ReportJson } from "@persona-lab/shared";
import type { Prisma } from "@prisma/client";

interface ConfusionEntry {
  issue: string;
  evidence: string;
  elementRef?: string;
  personaId: string;
  personaName: string;
  stepIndex: number;
  screenIndex: number;
  friction: number;
  dropoffRisk: number;
}

interface ClusteredIssue {
  issue: string;
  entries: ConfusionEntry[];
}

function normalizeString(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}

function similarity(a: string, b: string): number {
  const wordsA = new Set(normalizeString(a).split(/\s+/));
  const wordsB = new Set(normalizeString(b).split(/\s+/));
  const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

function clusterConfusions(entries: ConfusionEntry[]): ClusteredIssue[] {
  const clusters: ClusteredIssue[] = [];
  const threshold = 0.25;

  for (const entry of entries) {
    let bestCluster: ClusteredIssue | null = null;
    let bestScore = 0;

    for (const cluster of clusters) {
      const score = similarity(entry.issue, cluster.issue);
      if (score > bestScore && score >= threshold) {
        bestScore = score;
        bestCluster = cluster;
      }
    }

    if (bestCluster) {
      bestCluster.entries.push(entry);
    } else {
      clusters.push({ issue: entry.issue, entries: [entry] });
    }
  }

  return clusters;
}

export async function handleAggregateReport(job: AggregateReportJob) {
  const tag = `[aggregate:${job.runId.slice(0, 8)}]`;
  console.log(`${tag} Starting report aggregation`);

  const run = await prisma.run.findUnique({
    where: { id: job.runId },
    include: {
      episodes: {
        include: {
          persona: true,
          steps: {
            include: { frame: true },
            orderBy: { stepIndex: "asc" },
          },
        },
      },
    },
  });

  if (!run) throw new Error(`Run ${job.runId} not found`);

  const totalSteps = run.episodes.reduce((sum, ep) => sum + ep.steps.length, 0);
  const epStatuses = run.episodes.map(ep => `${ep.persona.name}:${ep.status}`).join(", ");
  console.log(`${tag} ${run.episodes.length} episodes (${epStatuses}), ${totalSteps} total steps`);

  // Collect all confusions from all step traces
  const allConfusions: ConfusionEntry[] = [];

  // Also track per-screen friction/dropoff across all episodes
  const screenStepsMap = new Map<number, { friction: number; dropoffRisk: number; confusionCount: number }[]>();

  // Determine if this is an agent-mode run by checking if any step lacks a frame
  const isAgentMode = run.episodes.some((ep) => ep.steps.some((s) => !s.frame));

  // For agent mode: build URL → screen index mapping
  const urlToScreenIndex = new Map<string, number>();
  let nextScreenIndex = 0;

  function getScreenIndex(step: { frame: { stepIndex: number } | null; observation: unknown }): number {
    if (step.frame) return step.frame.stepIndex;
    // Agent mode: derive from URL pathname
    const obs = step.observation as { url?: string } | null;
    const url = obs?.url ?? "unknown";
    try {
      const pathname = new URL(url).pathname;
      if (!urlToScreenIndex.has(pathname)) {
        urlToScreenIndex.set(pathname, nextScreenIndex++);
      }
      return urlToScreenIndex.get(pathname)!;
    } catch {
      if (!urlToScreenIndex.has(url)) {
        urlToScreenIndex.set(url, nextScreenIndex++);
      }
      return urlToScreenIndex.get(url)!;
    }
  }

  // Build reverse mapping for screen labels (for agent mode findings)
  function getScreenUrl(screenIndex: number): string | undefined {
    if (!isAgentMode) return undefined;
    for (const [url, idx] of urlToScreenIndex) {
      if (idx === screenIndex) return url;
    }
    return undefined;
  }

  for (const episode of run.episodes) {
    for (const step of episode.steps) {
      const screenIndex = getScreenIndex(step);

      const reasoning = step.reasoning as {
        confusions?: Array<{
          issue: string;
          evidence: string;
          elementRef?: string;
        }>;
      };

      const confusionCount = reasoning.confusions?.length ?? 0;

      // Track per-screen stats
      if (!screenStepsMap.has(screenIndex)) {
        screenStepsMap.set(screenIndex, []);
      }
      screenStepsMap.get(screenIndex)!.push({
        friction: step.friction,
        dropoffRisk: step.dropoffRisk,
        confusionCount,
      });

      if (reasoning.confusions) {
        for (const confusion of reasoning.confusions) {
          allConfusions.push({
            issue: confusion.issue,
            evidence: confusion.evidence,
            elementRef: confusion.elementRef,
            personaId: episode.personaId,
            personaName: episode.persona.name,
            stepIndex: step.stepIndex,
            screenIndex,
            friction: step.friction,
            dropoffRisk: step.dropoffRisk,
          });
        }
      }
    }
  }

  // Group confusions by frame, then cluster within each frame
  const confusionsByFrame = new Map<number, ConfusionEntry[]>();
  for (const c of allConfusions) {
    if (!confusionsByFrame.has(c.screenIndex)) confusionsByFrame.set(c.screenIndex, []);
    confusionsByFrame.get(c.screenIndex)!.push(c);
  }

  const findings: Array<{
    issue: string;
    evidence: string;
    severity: number;
    frequency: number;
    affectedPersonas: string[];
    elementRef: string | null;
    stepIndex: number;
    screenIndex: number;
  }> = [];

  for (const [frameIndex, frameConfusions] of confusionsByFrame) {
    const clusters = clusterConfusions(frameConfusions);
    for (const cluster of clusters) {
      const frequency = cluster.entries.length;
      const avgFriction =
        cluster.entries.reduce((sum, e) => sum + e.friction, 0) / frequency;
      const avgDropoff =
        cluster.entries.reduce((sum, e) => sum + e.dropoffRisk, 0) / frequency;
      // sqrt scaling prevents low individual scores from compounding to near-zero
      const severity = Math.sqrt(frequency) * (avgDropoff + avgFriction) / 2;
      const affectedPersonas = [
        ...new Set(cluster.entries.map((e) => e.personaName)),
      ];
      const firstEntry = cluster.entries[0];

      findings.push({
        issue: cluster.issue,
        evidence: firstEntry.evidence,
        severity,
        frequency,
        affectedPersonas,
        elementRef: firstEntry.elementRef || null,
        stepIndex: firstEntry.stepIndex,
        screenIndex: frameIndex,
      });
    }
  }

  findings.sort((a, b) => b.severity - a.severity);

  console.log(`${tag} Collected ${allConfusions.length} total confusions across ${confusionsByFrame.size} screens`);
  console.log(`${tag} Clustered into ${findings.length} findings`);
  for (const f of findings.slice(0, 5)) {
    console.log(`${tag}   Finding: "${f.issue.slice(0, 80)}" severity=${f.severity.toFixed(3)} freq=${f.frequency} personas=${f.affectedPersonas.join(",")}`);
  }

  // Try to get LLM-generated fixes for top findings
  const config = run.config as { model?: string };
  let enrichedFindings = findings.map((f) => ({ ...f, recommendedFix: null as string | null }));

  try {
    const llm = createLLMProvider(config.model || "anthropic/claude-sonnet-4");

    const topFindings = findings.slice(0, 5);
    if (topFindings.length > 0) {
      const fixPrompt = `Given these UX usability findings, suggest a brief fix for each:

${topFindings.map((f, i) => `${i + 1}. Issue: ${f.issue}\n   Evidence: ${f.evidence}\n   Severity: ${f.severity.toFixed(2)}\n   Affected: ${f.affectedPersonas.join(", ")}`).join("\n\n")}

Respond as JSON:
{
  "fixes": [
    { "index": 0, "fix": "Brief recommended fix" }
  ]
}`;

      const fixResponse = await llm.completeJSON(
        fixPrompt,
        (await import("zod")).z.object({
          fixes: (await import("zod")).z.array(
            (await import("zod")).z.object({
              index: (await import("zod")).z.number(),
              fix: (await import("zod")).z.string(),
            })
          ),
        })
      );

      for (const fix of fixResponse.fixes) {
        if (enrichedFindings[fix.index]) {
          enrichedFindings[fix.index].recommendedFix = fix.fix;
        }
      }
    }
  } catch (err) {
    console.warn("Failed to generate LLM fixes, using template fallback:", err);
    enrichedFindings = enrichedFindings.map((f) => ({
      ...f,
      recommendedFix: f.recommendedFix || `Review and improve clarity of: ${f.issue}`,
    }));
  }

  // Create Finding records
  for (const f of enrichedFindings) {
    await prisma.finding.create({
      data: {
        runId: run.id,
        issue: f.issue,
        evidence: f.evidence,
        severity: f.severity,
        frequency: f.frequency,
        affectedPersonas: f.affectedPersonas,
        elementRef: f.elementRef,
        stepIndex: f.stepIndex,
        screenUrl: getScreenUrl(f.screenIndex),
        recommendedFix: f.recommendedFix,
      },
    });
  }

  // Build report JSON
  const totalEpisodes = run.episodes.length;
  const completedEpisodes = run.episodes.filter(
    (e) => e.status === "COMPLETED"
  ).length;
  const abandonedEpisodes = run.episodes.filter(
    (e) => e.status === "ABANDONED"
  ).length;

  const allSteps = run.episodes.flatMap((e) => e.steps);
  const avgFriction =
    allSteps.length > 0
      ? allSteps.reduce((sum, s) => sum + s.friction, 0) / allSteps.length
      : 0;
  const avgDropoffRisk =
    allSteps.length > 0
      ? allSteps.reduce((sum, s) => sum + s.dropoffRisk, 0) / allSteps.length
      : 0;

  const perPersona = run.episodes.map((episode) => {
    const steps = episode.steps;
    const confusions: Array<{ issue: string; evidence: string; stepIndex: number; screenIndex?: number }> = [];

    for (const step of steps) {
      const screenIdx = getScreenIndex(step);
      const reasoning = step.reasoning as {
        confusions?: Array<{ issue: string; evidence: string }>;
      };
      if (reasoning.confusions) {
        for (const c of reasoning.confusions) {
          confusions.push({
            issue: c.issue,
            evidence: c.evidence,
            stepIndex: step.stepIndex,
            screenIndex: screenIdx,
          });
        }
      }
    }

    // Extract OCEAN traits if available
    const personaTraits = episode.persona.traits as Record<string, number> | null;
    const traitValues = personaTraits
      ? Object.fromEntries(
          Object.entries(personaTraits).filter(
            ([, v]) => typeof v === "number"
          )
        )
      : undefined;

    return {
      personaId: episode.personaId,
      personaName: episode.persona.name,
      ageGroup: episode.persona.ageGroup ?? undefined,
      gender: episode.persona.gender ?? undefined,
      traits: traitValues,
      episodeStatus: episode.status,
      avgFriction:
        steps.length > 0
          ? steps.reduce((sum, s) => sum + s.friction, 0) / steps.length
          : 0,
      avgConfidence:
        steps.length > 0
          ? steps.reduce((sum, s) => sum + s.confidence, 0) / steps.length
          : 0,
      stepsCount: steps.length,
      confusions,
    };
  });

  // Build per-screen stats
  const perScreen = Array.from(screenStepsMap.entries())
    .map(([screenIndex, steps]) => {
      const avgScreenFriction = steps.reduce((s, x) => s + x.friction, 0) / steps.length;
      const maxScreenFriction = Math.max(...steps.map((x) => x.friction));
      const avgScreenDropoff = steps.reduce((s, x) => s + x.dropoffRisk, 0) / steps.length;
      const confusionCount = steps.reduce((s, x) => s + x.confusionCount, 0);
      const findingCount = enrichedFindings.filter((f) => f.screenIndex === screenIndex).length;

      return {
        screenIndex,
        screenLabel: getScreenUrl(screenIndex),
        avgFriction: avgScreenFriction,
        maxFriction: maxScreenFriction,
        avgDropoffRisk: avgScreenDropoff,
        confusionCount,
        findingCount,
        totalSteps: steps.length,
      };
    })
    .sort((a, b) => a.screenIndex - b.screenIndex);

  const reportJson: ReportJson = {
    summary: {
      totalEpisodes,
      completedEpisodes,
      abandonedEpisodes,
      avgFriction,
      avgDropoffRisk,
    },
    findings: enrichedFindings.map((f) => ({
      issue: f.issue,
      evidence: f.evidence,
      severity: f.severity,
      frequency: f.frequency,
      affectedPersonas: f.affectedPersonas,
      elementRef: f.elementRef || undefined,
      stepIndex: f.stepIndex,
      screenIndex: f.screenIndex,
      recommendedFix: f.recommendedFix || undefined,
    })),
    perScreen,
    perPersona,
  };

  // Update run with report
  await prisma.run.update({
    where: { id: run.id },
    data: {
      status: "COMPLETED",
      reportJson: reportJson as unknown as Prisma.InputJsonValue,
    },
  });

  console.log(`${tag} Report saved — ${enrichedFindings.length} findings, avgFriction=${avgFriction.toFixed(3)}, completed=${completedEpisodes}/${totalEpisodes}, ${perScreen.length} screens`);
}
