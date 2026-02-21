import { Queue } from "bullmq";
import { prisma } from "../lib/prisma.js";
import { storage } from "../lib/storage.js";
import { createLLMProvider } from "../lib/llm/openrouter-provider.js";
import { getRedisOpts } from "../lib/redis.js";
import { BrowserContainer } from "../lib/browser/container.js";
import { BrowserSession } from "../lib/browser/session.js";
import { extractInteractiveElements, formatElementList } from "../lib/browser/extract-elements.js";
import type { InteractiveElement } from "../lib/browser/extract-elements.js";
import {
  AgentReasoningOutput,
  QUEUE_NAMES,
  buildPersonaContext,
} from "@persona-lab/shared";
import type { SimulateAgentEpisodeJob, AggregateReportJob } from "@persona-lab/shared";
import type { Prisma } from "@prisma/client";

const MAX_STUCK_COUNT = 3;

/**
 * Repair common LLM mistakes in the raw JSON before Zod validation.
 * LLMs frequently return structurally close but not quite valid output.
 */
function repairRawOutput(raw: Record<string, unknown>): Record<string, unknown> {
  const action = raw.browserAction as Record<string, unknown> | undefined;
  if (!action) return raw;

  // "type" action missing "text" → demote to "click" (LLM meant click but said type)
  if (action.type === "type" && !action.text) {
    if (typeof action.elementIndex === "number") {
      action.type = "click";
      delete action.text;
    }
  }

  // "click" action missing "elementIndex" but has coordinates → convert to click_coordinates
  if (action.type === "click" && action.elementIndex == null && action.x != null && action.y != null) {
    action.type = "click_coordinates";
  }

  // "click" action with out-of-range or missing elementIndex → fallback to scroll down
  if (action.type === "click" && action.elementIndex == null) {
    action.type = "scroll";
    action.direction = "down";
  }

  // "done" action missing required fields
  if (action.type === "done") {
    if (action.success == null) action.success = false;
    if (!action.reason) action.reason = "Goal not reached";
  }

  // "wait" action missing reason
  if (action.type === "wait" && !action.reason) {
    action.reason = "Waiting for page to load";
  }

  // Ensure intent is a valid Action enum value
  const validIntents = [
    "CLICK_PRIMARY_CTA", "CLICK_SECONDARY_CTA", "OPEN_NAV", "SCROLL",
    "BACK", "SEEK_INFO", "HESITATE", "ABANDON",
  ];
  if (!validIntents.includes(raw.intent as string)) {
    // Guess intent from browser action type
    const intentMap: Record<string, string> = {
      click: "CLICK_PRIMARY_CTA",
      click_coordinates: "CLICK_PRIMARY_CTA",
      type: "CLICK_PRIMARY_CTA",
      scroll: "SCROLL",
      navigate_back: "BACK",
      wait: "HESITATE",
      done: "ABANDON",
    };
    raw.intent = intentMap[action.type as string] ?? "SEEK_INFO";
  }

  // Ensure confusions is an array
  if (!Array.isArray(raw.confusions)) {
    raw.confusions = [];
  }

  return raw;
}

interface ScrollInfo {
  scrollY: number;
  viewportHeight: number;
  pageHeight: number;
}

function buildAgentReasoningPrompt(
  personaContext: string,
  goal: string,
  memory: string | null,
  stepIndex: number,
  maxSteps: number,
  currentUrl: string,
  elementList: string,
  stuckCount: number,
  scrollInfo: ScrollInfo,
): string {
  const stuckHint = stuckCount >= 2
    ? `\n\nWARNING: You have been on the same URL for ${stuckCount} consecutive actions. Try a different approach, navigate elsewhere, or give up if you're stuck.\n`
    : "";

  const memorySection = memory
    ? `\n## Your Memory from Previous Steps\n${memory}\n`
    : "";

  // Build scroll context so the agent knows the page extends beyond the viewport
  const scrollBottom = scrollInfo.scrollY + scrollInfo.viewportHeight;
  const scrollPct = Math.round((scrollBottom / scrollInfo.pageHeight) * 100);
  const canScrollDown = scrollBottom < scrollInfo.pageHeight - 10;
  const canScrollUp = scrollInfo.scrollY > 10;

  let scrollContext = `\n## Page Scroll Position\n`;
  scrollContext += `Viewport: ${scrollInfo.viewportHeight}px tall. Page total: ${scrollInfo.pageHeight}px. `;
  scrollContext += `Currently viewing: ${scrollInfo.scrollY}px – ${scrollBottom}px (${scrollPct}% of page).`;
  if (canScrollDown) {
    const remaining = scrollInfo.pageHeight - scrollBottom;
    scrollContext += `\n**${remaining}px of content below the fold — you have NOT seen the bottom of this page.** If you cannot find what you need, scroll down before giving up.`;
  } else {
    scrollContext += `\nYou are at the bottom of the page — no more content below.`;
  }
  if (canScrollUp) {
    scrollContext += ` You can also scroll up (${scrollInfo.scrollY}px above).`;
  }

  return `${personaContext}

## Goal
You are trying to: "${goal}"
Step ${stepIndex + 1} of max ${maxSteps}. Current URL: ${currentUrl}
${scrollContext}

## Interactive Elements (visible in current viewport)
${elementList}

## Screenshot (current viewport only — page may extend beyond what you see)
[attached PNG]
${memorySection}${stuckHint}

## Instructions
You ARE this persona. First person. Identify friction, then pick a concrete action.

Analyze this page critically. Identify friction points, confusions, and obstacles from your persona's perspective. Even well-designed pages have minor issues — evaluate strictly based on your behavioral profile.

IMPORTANT: The screenshot and element list only show what is currently visible in the viewport. If the page is taller than the viewport, there is more content above or below that you haven't seen yet. Check the scroll position above — if you haven't seen the full page and can't find what you need, SCROLL DOWN before concluding something is missing.

MANDATORY: You are FORBIDDEN from choosing "done" with success=false if there is unseen content below the viewport. You MUST scroll down to view the entire page before giving up. If the scroll position shows you are not at the bottom, your next action MUST be "scroll" with direction "down".

Pick ONE concrete browser action to execute:
- click: click an interactive element by index number. Requires: { "type": "click", "elementIndex": <number> }
- click_coordinates: click a specific x,y position (only if no element matches). Requires: { "type": "click_coordinates", "x": <number>, "y": <number> }
- type: type text into an input field. Requires: { "type": "type", "elementIndex": <number>, "text": "<string>", "submit": true|false }. Set "submit": true to press Enter after typing — useful for search bars and forms that have no visible submit button. If there IS a visible search/submit button you want to click, set "submit": false and click the button as a separate action.
- scroll: scroll to see more content. Requires: { "type": "scroll", "direction": "up" | "down" }
- navigate_back: go back to the previous page. Requires: { "type": "navigate_back" }
- wait: wait for the page to load. Requires: { "type": "wait", "reason": "<string>" }
- done: goal reached or giving up. Requires: { "type": "done", "success": true|false, "reason": "<string>" }

Also provide an abstract "intent" for report compatibility: one of CLICK_PRIMARY_CTA, CLICK_SECONDARY_CTA, OPEN_NAV, SCROLL, BACK, SEEK_INFO, HESITATE, ABANDON.

Respond as JSON:
{
  "salient": "what stands out most to me on this screen",
  "confusions": [
    { "issue": "I couldn't tell which button...", "evidence": "what on screen caused it", "elementRef": "optional element label" }
  ],
  "browserAction": { "type": "click", "elementIndex": 0 },
  "intent": "CLICK_PRIMARY_CTA",
  "confidence": 0.0 to 1.0,
  "friction": 0.0 to 1.0,
  "dropoffRisk": 0.0 to 1.0,
  "memoryUpdate": "optional note to carry forward"
}`;
}

export async function handleSimulateAgentEpisode(job: SimulateAgentEpisodeJob) {
  const tag = `[agent_episode:${job.episodeId.slice(0, 8)}]`;
  console.log(`${tag} Starting — run=${job.runId.slice(0, 8)} model=${job.model} url=${job.url}`);

  const episode = await prisma.episode.findUnique({
    where: { id: job.episodeId },
    include: { persona: true },
  });
  if (!episode) throw new Error(`Episode ${job.episodeId} not found`);

  // Mark episode as running
  await prisma.episode.update({
    where: { id: episode.id },
    data: { status: "RUNNING" },
  });

  const llm = createLLMProvider(job.model);
  const personaContext = buildPersonaContext(episode.persona);

  let episodeStatus: "COMPLETED" | "ABANDONED" | "FAILED" = "COMPLETED";
  let memory: string | null = null;
  let prevUrl = "";
  let stuckCount = 0;

  const skipDocker = process.env.BROWSER_MODE === "local";
  const container = skipDocker ? null : new BrowserContainer();
  const session = new BrowserSession();

  try {
    if (container) {
      // Docker-isolated browser per episode (default)
      console.log(`${tag} Starting Docker browser container...`);
      await container.start();
      const endpoint = container.getEndpoint();
      console.log(`${tag} Container ready at ${endpoint}`);
      await session.connect(endpoint);
    } else {
      // Local dev fallback: direct Playwright launch (BROWSER_MODE=local)
      console.log(`${tag} Launching local browser (no Docker)...`);
      await session.launch({ headless: false });
      console.log(`${tag} Browser ready`);
    }

    // Navigate to the starting URL
    await session.navigate(job.url);
    console.log(`${tag} Navigated to ${job.url}`);

    for (let stepIdx = 0; stepIdx < job.maxSteps; stepIdx++) {
      const currentUrl = await session.getUrl();
      const pageTitle = await session.getTitle();

      // Track stuck detection
      if (currentUrl === prevUrl) {
        stuckCount++;
      } else {
        stuckCount = 0;
        prevUrl = currentUrl;
      }

      // Force abandon if stuck too long
      if (stuckCount >= MAX_STUCK_COUNT) {
        console.log(`${tag} Step ${stepIdx}: stuck on ${currentUrl} for ${stuckCount} actions, forcing abandon`);
        episodeStatus = "ABANDONED";
        break;
      }

      // Capture screenshot
      const screenshotBuffer = await session.screenshot();
      const screenshotKey = `agent-runs/${job.runId}/${job.episodeId}/step-${stepIdx}.png`;
      await storage.save(screenshotKey, screenshotBuffer);
      console.log(`${tag} Step ${stepIdx}: screenshot saved (${(screenshotBuffer.length / 1024).toFixed(0)} KB)`);

      // Get scroll position so the agent knows how much page is left
      const scrollInfo = await session.getScrollInfo();

      // Extract interactive elements
      let elements: InteractiveElement[] = [];
      try {
        elements = await extractInteractiveElements(session.page!);
      } catch (err) {
        console.warn(`${tag} Step ${stepIdx}: element extraction failed:`, err);
      }
      const elementList = formatElementList(elements);

      // Build prompt and call LLM
      const prompt = buildAgentReasoningPrompt(
        personaContext,
        job.goal,
        memory,
        stepIdx,
        job.maxSteps,
        currentUrl,
        elementList,
        stuckCount,
        scrollInfo,
      );

      let reasoning: AgentReasoningOutput;
      try {
        console.log(`${tag} Step ${stepIdx}: calling LLM (${elements.length} elements)...`);

        // Get raw JSON from LLM, repair common mistakes, then validate
        const { z } = await import("zod");
        const rawSchema = z.record(z.unknown());
        const raw = await llm.completeJSONWithImage(screenshotBuffer, prompt, rawSchema);
        const repaired = repairRawOutput(raw as Record<string, unknown>);
        reasoning = AgentReasoningOutput.parse(repaired);

        console.log(`${tag} Step ${stepIdx}: action=${reasoning.browserAction.type} intent=${reasoning.intent} friction=${reasoning.friction}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`${tag} Step ${stepIdx} LLM FAILED: ${msg}`);
        episodeStatus = "FAILED";
        break;
      }

      // Create StepTrace (frameId is null for agent mode)
      await prisma.stepTrace.create({
        data: {
          episodeId: episode.id,
          stepIndex: stepIdx,
          // frameId is null for agent mode
          screenshotPath: screenshotKey,
          observation: {
            url: currentUrl,
            pageTitle,
            elementCount: elements.length,
          },
          reasoning: reasoning as unknown as Prisma.InputJsonValue,
          action: reasoning.intent,
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

      // Guard: prevent premature abandonment if page hasn't been fully viewed
      if (reasoning.browserAction.type === "done" && !reasoning.browserAction.success) {
        const bottomEdge = scrollInfo.scrollY + scrollInfo.viewportHeight;
        const hasSeenBottom = bottomEdge >= scrollInfo.pageHeight - 50;
        if (!hasSeenBottom) {
          const unseen = scrollInfo.pageHeight - bottomEdge;
          console.log(`${tag} Step ${stepIdx}: agent wants to abandon but ${unseen}px unseen below — forcing scroll`);
          await session.executeAction({ type: "scroll", direction: "down" as const }, elements);
          continue;
        }
      }

      // Check if done
      if (reasoning.browserAction.type === "done") {
        episodeStatus = reasoning.browserAction.success ? "COMPLETED" : "ABANDONED";
        console.log(`${tag} Step ${stepIdx}: done (${episodeStatus}) — ${reasoning.browserAction.reason}`);
        break;
      }

      // Execute the browser action
      try {
        await session.executeAction(reasoning.browserAction, elements);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`${tag} Step ${stepIdx}: action execution failed: ${msg}`);
        // Continue — the page might still be usable
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${tag} Fatal error: ${msg}`);
    episodeStatus = "FAILED";
  } finally {
    // Always clean up
    await session.close().catch(() => {});
    if (container) await container.stop().catch(() => {});
    console.log(`${tag} Browser closed`);
  }

  // Update episode status
  console.log(`${tag} Episode finished: ${episodeStatus}`);
  await prisma.episode.update({
    where: { id: episode.id },
    data: { status: episodeStatus },
  });

  // Check if all episodes for this run are done
  await checkAndAdvanceRun(job.runId);
}

async function checkAndAdvanceRun(runId: string) {
  const pendingOrRunning = await prisma.episode.count({
    where: {
      runId,
      status: { in: ["PENDING", "RUNNING"] },
    },
  });

  if (pendingOrRunning > 0) return;

  // All episodes done — advance to aggregation
  await prisma.run.update({
    where: { id: runId },
    data: { status: "AGGREGATING" },
  });

  const aggregateQueue = new Queue(QUEUE_NAMES.AGGREGATE_REPORT, { connection: getRedisOpts() });
  const agJob: AggregateReportJob = { runId };
  await aggregateQueue.add(QUEUE_NAMES.AGGREGATE_REPORT, agJob);
  await aggregateQueue.close();
}
