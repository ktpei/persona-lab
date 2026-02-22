import { Queue } from "bullmq";
import { prisma } from "../lib/prisma.js";
import { storage } from "../lib/storage.js";
import { createLLMProvider } from "../lib/llm/openrouter-provider.js";
import { getRedisOpts } from "../lib/redis.js";
import {
  ReasoningOutput,
  QUEUE_NAMES,
  buildPersonaContext,
} from "@persona-lab/shared";
import type { SimulateEpisodeJob, AggregateReportJob } from "@persona-lab/shared";
import type { Prisma } from "@prisma/client";

async function isRunCancelled(runId: string): Promise<boolean> {
  const run = await prisma.run.findUnique({ where: { id: runId }, select: { status: true } });
  return run?.status === "CANCELLED";
}

function buildReasoningPrompt(
  personaContext: string,
  flowName: string,
  memory: string | null,
  stepIndex: number,
  totalFrames: number,
  currentFrame: number,
  sameFrameCount: number,
  scrollHint: string | null
): string {
  const stuckHint = sameFrameCount >= 2
    ? `\n\nNOTE: You have already spent ${sameFrameCount} actions on this same screen without advancing. If you cannot find what you need, consider clicking a CTA to advance or abandoning.\n`
    : "";

  const scrollWarning = scrollHint ? `\n\n${scrollHint}\n` : "";

  return `${personaContext}

## Goal
You are trying to complete this UX flow: "${flowName}"
This flow has ${totalFrames} screens. You are currently on screen ${currentFrame + 1} of ${totalFrames}, step ${stepIndex + 1} overall.

The attached screenshot shows the current screen. Analyze it and decide what to do next.

IMPORTANT: Each screenshot is a complete, static capture of the entire page. Choosing SCROLL will NOT reveal additional content — you will see this exact same image again. Only choose SCROLL if you genuinely want to re-read what is already visible. If you have already viewed this screen, choose a forward action (click a CTA) or ABANDON.

${memory ? `## Your Memory from Previous Steps\n${memory}\n` : ""}${stuckHint}${scrollWarning}

## Instructions
You ARE this persona. Describe all confusions and observations in the first person — say "I", not "the user".

Analyze this screen critically. You MUST identify at least one friction point or confusion for each screen — even well-designed pages have minor issues (unclear labels, too many options, missing information, visual clutter, unclear next step, small text, unfamiliar terminology, etc.). Evaluate strictly from your specific behavioral profile.

For example: if you are impatient, even a small delay or extra click is friction. If you have low exploration tendency, unfamiliar layouts or hidden navigation cause confusion. If you have high frustration sensitivity, ambiguous labels or too many choices are friction points.

A friction score of 0.0 should be extremely rare — reserve it only for screens that are absolutely perfectly clear for you. Most screens should have friction of at least 0.1-0.3.

After identifying friction, decide what action you would most likely take to complete "${flowName}".

Respond as JSON:
{
  "salient": "what stands out most to me on this screen",
  "confusions": [
    { "issue": "I couldn't tell which button takes me to checkout", "evidence": "what on screen caused it", "elementRef": "optional element label" }
  ],
  "likelyAction": "one of: CLICK_PRIMARY_CTA, CLICK_SECONDARY_CTA, OPEN_NAV, SCROLL, BACK, SEEK_INFO, HESITATE, ABANDON",
  "confidence": 0.0 to 1.0,
  "friction": 0.0 to 1.0,
  "dropoffRisk": 0.0 to 1.0,
  "memoryUpdate": "optional note to carry forward to the next step"
}`;
}

function resolveNextStep(
  action: string,
  currentStep: number,
  totalFrames: number
): { nextStep: number; ended: boolean; status: "RUNNING" | "COMPLETED" | "ABANDONED" } {
  switch (action) {
    case "ABANDON":
      return { nextStep: currentStep, ended: true, status: "ABANDONED" };
    case "BACK":
      return { nextStep: Math.max(0, currentStep - 1), ended: false, status: "RUNNING" };
    case "HESITATE":
    case "SCROLL":
    case "SEEK_INFO":
      return { nextStep: currentStep, ended: false, status: "RUNNING" };
    default: {
      // Forward actions: CLICK_PRIMARY_CTA, CLICK_SECONDARY_CTA, OPEN_NAV
      const next = currentStep + 1;
      if (next >= totalFrames) {
        return { nextStep: currentStep, ended: true, status: "COMPLETED" };
      }
      return { nextStep: next, ended: false, status: "RUNNING" };
    }
  }
}

export async function handleSimulateEpisode(job: SimulateEpisodeJob) {
  const tag = `[simulate_episode:${job.episodeId.slice(0, 8)}]`;
  console.log(`${tag} Starting — run=${job.runId.slice(0, 8)} model=${job.model}`);

  const episode = await prisma.episode.findUnique({
    where: { id: job.episodeId },
    include: { persona: true },
  });
  if (!episode) throw new Error(`Episode ${job.episodeId} not found`);

  // Skip if episode was already cancelled (bulk update from cancel API)
  if (episode.status === "CANCELLED") {
    console.log(`${tag} Episode already cancelled, skipping`);
    await checkAndAdvanceRun(job.runId);
    return;
  }

  // Mark episode as running
  await prisma.episode.update({
    where: { id: episode.id },
    data: { status: "RUNNING" },
  });

  const run = await prisma.run.findUnique({
    where: { id: job.runId },
    include: { flow: { select: { name: true } } },
  });
  if (!run) throw new Error(`Run ${job.runId} not found`);

  const flowName = run.flow.name;

  // Get all frames for the flow, ordered by stepIndex
  const frames = await prisma.frame.findMany({
    where: { flowId: run.flowId },
    orderBy: { stepIndex: "asc" },
  });

  console.log(`${tag} Flow "${flowName}" (${run.flowId.slice(0, 8)}) has ${frames.length} frames`);

  if (frames.length === 0) {
    throw new Error("No frames found for flow");
  }

  const llm = createLLMProvider(job.model);
  const personaContext = buildPersonaContext(episode.persona);

  let currentStep = 0;
  let memory: string | null = null;
  let episodeStatus: "COMPLETED" | "ABANDONED" | "FAILED" | "CANCELLED" = "COMPLETED";
  let sameFrameCount = 0;
  let scrollCountOnFrame = 0;
  let prevStep = -1;
  const MAX_SAME_FRAME = 3; // General fallback for HESITATE/SEEK_INFO loops
  const MAX_SCROLL_ON_FRAME = 2; // Auto-advance after 2 SCROLLs on same frame

  for (let stepIdx = 0; stepIdx < job.maxSteps; stepIdx++) {
    const frame = frames[currentStep];
    if (!frame) break;

    // Check for run cancellation
    if (await isRunCancelled(job.runId)) {
      console.log(`${tag} Step ${stepIdx}: run cancelled, stopping episode`);
      episodeStatus = "CANCELLED";
      break;
    }

    // Track how many times we've stayed on the same frame
    if (currentStep === prevStep) {
      sameFrameCount++;
    } else {
      sameFrameCount = 0;
      scrollCountOnFrame = 0;
      prevStep = currentStep;
    }

    // Force-advance if stuck on the same frame too long (general fallback)
    if (sameFrameCount >= MAX_SAME_FRAME) {
      console.log(`${tag} Step ${stepIdx}: stuck on frame ${currentStep} for ${sameFrameCount} actions, force-advancing`);
      // On the last frame, complete instead of trying to advance
      if (currentStep >= frames.length - 1) {
        episodeStatus = "COMPLETED";
        break;
      }
      currentStep = currentStep + 1;
      sameFrameCount = 0;
      scrollCountOnFrame = 0;
      prevStep = currentStep;
      continue;
    }

    // Build scroll-specific hint for the prompt
    let scrollHint: string | null = null;
    if (scrollCountOnFrame >= 1) {
      scrollHint = `WARNING: You have already scrolled ${scrollCountOnFrame} time(s) on this screen. These screenshots are static full-page captures — scrolling will NOT reveal any new content. You MUST choose a different action: click a CTA to advance, or ABANDON if you cannot proceed.`;
    }

    const prompt = buildReasoningPrompt(
      personaContext,
      flowName,
      memory,
      stepIdx,
      frames.length,
      currentStep,
      sameFrameCount,
      scrollHint
    );

    let reasoning: ReasoningOutput;
    try {
      console.log(`${tag} Step ${stepIdx}: loading frame ${currentStep} (${frame.imagePath})`);
      const imageBuffer = await storage.get(frame.imagePath);
      console.log(`${tag} Step ${stepIdx}: image loaded (${(imageBuffer.length / 1024).toFixed(0)} KB), calling LLM...`);
      reasoning = await llm.completeJSONWithImage(imageBuffer, prompt, ReasoningOutput);
      console.log(`${tag} Step ${stepIdx}: action=${reasoning.likelyAction} friction=${reasoning.friction} confidence=${reasoning.confidence} confusions=${reasoning.confusions?.length ?? 0}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      console.error(`${tag} Step ${stepIdx} FAILED: ${msg}`);
      if (stack) console.error(stack);
      episodeStatus = "FAILED";
      break;
    }

    // Intercept SCROLL on same frame: auto-convert after MAX_SCROLL_ON_FRAME
    if (reasoning.likelyAction === "SCROLL") {
      scrollCountOnFrame++;
      if (scrollCountOnFrame >= MAX_SCROLL_ON_FRAME) {
        console.log(`${tag} Step ${stepIdx}: ${scrollCountOnFrame} SCROLLs on frame ${currentStep}, auto-converting to CLICK_PRIMARY_CTA`);
        reasoning = { ...reasoning, likelyAction: "CLICK_PRIMARY_CTA" };
      }
    }

    // Record step trace
    await prisma.stepTrace.create({
      data: {
        episodeId: episode.id,
        stepIndex: stepIdx,
        frameId: frame.id,
        observation: {
          frameStepIndex: currentStep,
        },
        reasoning: reasoning as unknown as Prisma.InputJsonValue,
        action: reasoning.likelyAction,
        confidence: reasoning.confidence,
        friction: reasoning.friction,
        dropoffRisk: reasoning.dropoffRisk,
        memory: reasoning.memoryUpdate || null,
      },
    });

    // Update memory
    if (reasoning.memoryUpdate) {
      memory = memory
        ? `${memory}\n${reasoning.memoryUpdate}`
        : reasoning.memoryUpdate;
    }

    // Resolve next step
    const { nextStep, ended, status } = resolveNextStep(
      reasoning.likelyAction,
      currentStep,
      frames.length
    );

    if (ended) {
      episodeStatus = status as "COMPLETED" | "ABANDONED";
      break;
    }

    currentStep = nextStep;
  }

  // Update episode status
  console.log(`${tag} Episode finished: ${episodeStatus} (${currentStep + 1} frames visited)`);
  await prisma.episode.update({
    where: { id: episode.id },
    data: { status: episodeStatus },
  });

  // Check if all episodes for this run are done
  await checkAndAdvanceRun(job.runId);
}

async function checkAndAdvanceRun(runId: string) {
  const rtag = `[run:${runId.slice(0, 8)}]`;

  // Don't advance if run was cancelled
  const run = await prisma.run.findUnique({ where: { id: runId }, select: { status: true } });
  if (run?.status === "CANCELLED") {
    console.log(`${rtag} Run is cancelled, skipping aggregation check`);
    return;
  }

  const pendingOrRunning = await prisma.episode.count({
    where: {
      runId,
      status: { in: ["PENDING", "RUNNING"] },
    },
  });

  if (pendingOrRunning > 0) {
    console.log(`${rtag} ${pendingOrRunning} episode(s) still pending/running`);
    return;
  }

  // All episodes done — advance to aggregation
  console.log(`${rtag} All episodes complete — advancing to AGGREGATING`);
  await prisma.run.update({
    where: { id: runId },
    data: { status: "AGGREGATING" },
  });

  const aggregateQueue = new Queue(QUEUE_NAMES.AGGREGATE_REPORT, { connection: getRedisOpts() });

  const job: AggregateReportJob = { runId };
  await aggregateQueue.add(QUEUE_NAMES.AGGREGATE_REPORT, job);
  await aggregateQueue.close();
  console.log(`${rtag} Aggregation job enqueued`);
}
