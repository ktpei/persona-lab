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

async function isRunCancelled(runId: string): Promise<boolean> {
  const run = await prisma.run.findUnique({ where: { id: runId }, select: { status: true } });
  return run?.status === "CANCELLED";
}

/**
 * Repair common LLM mistakes in the raw JSON before Zod validation.
 * LLMs frequently return structurally close but not quite valid output.
 */
function repairRawOutput(raw: Record<string, unknown>): Record<string, unknown> {
  const action = raw.browserAction as Record<string, unknown> | undefined;
  if (!action) {
    console.warn(`[repair] No browserAction in LLM output. Keys: ${Object.keys(raw).join(", ")}`);
    return raw;
  }
  const originalType = action.type;

  // "type" action: default submit to true — most typing is into search/form fields
  // that have no separate submit button. LLM must explicitly set submit:false to suppress.
  if (action.type === "type" && action.submit == null) {
    action.submit = true;
  }

  // "type" action missing "text" → demote to "click" (LLM meant click but said type)
  if (action.type === "type" && !action.text) {
    if (typeof action.elementIndex === "number") {
      action.type = "click";
      delete action.text;
    }
  }

  // "click" action with out-of-range or missing elementIndex → fallback to scroll down
  if (action.type === "click" && action.elementIndex == null) {
    action.type = "scroll";
    action.direction = "down";
  }

  // "scroll_to" missing elementIndex → demote to scroll down
  if (action.type === "scroll_to" && action.elementIndex == null) {
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
      type: "CLICK_PRIMARY_CTA",
      scroll: "SCROLL",
      scroll_to: "SCROLL",
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

  // Log if repairs were made
  if (action.type !== originalType) {
    console.log(`[repair] browserAction.type changed: ${String(originalType)} → ${String(action.type)}`);
  }
  if (!validIntents.includes(raw.intent as string)) {
    // intent was already fixed above, but log
    console.log(`[repair] intent was invalid, remapped to "${raw.intent}"`);
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
  overlayDetected: boolean,
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
  const scrollDelta = Math.round(scrollInfo.viewportHeight * 0.65);

  let scrollContext = `\n## Page Scroll Position\n`;
  scrollContext += `Viewport: ${scrollInfo.viewportHeight}px tall. Page total: ${scrollInfo.pageHeight}px. `;
  scrollContext += `Currently viewing: ${scrollInfo.scrollY}px – ${scrollBottom}px (${scrollPct}% of page).`;
  scrollContext += `\nEach "scroll" action moves ~${scrollDelta}px (~65% of viewport, 35% overlap with current view).`;
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
Your task is: "${goal}"
Step ${stepIndex + 1} of max ${maxSteps}. Current URL: ${currentUrl}

CRITICAL: Your task is ONLY what is described above — nothing more. As soon as the goal is achieved, immediately choose "done" with success=true. Do NOT continue beyond the goal. For example:
- "Add item to cart" → stop once the item is confirmed in the cart. Do NOT proceed to checkout, account creation, or payment.
- "Find product X" → stop once you're on the product page. Do NOT add it to cart.
- "Complete checkout" → stop once the order confirmation appears.
Interpret the goal literally and narrowly.
${scrollContext}

## Interactive Elements
${elementList}

## Screenshot (current viewport only — page may extend beyond what you see)
[attached PNG]
${overlayDetected ? `
## OVERLAY / MODAL DETECTED
A modal, dialog, or overlay is currently covering the page. Look at it carefully:
- If it's a SUCCESS confirmation (e.g. "Added to Cart", "Item added", "Order confirmed") → this means the goal may be achieved! Choose "done" with success=true.
- If it's a cookie consent / newsletter popup → dismiss it by clicking the accept/close button in the element list.
- If it's an image lightbox or zoom overlay → click the X/close button or use navigate_back to dismiss it.
- If it's a size/option selector → interact with it as needed for the goal.
Do NOT ignore the overlay — it is the most important thing on screen right now.
` : ""}${memorySection}${stuckHint}

## Instructions
You ARE this persona. First person. Identify friction, then pick a concrete action.

Analyze this page critically. You MUST identify at least one friction point or confusion for EVERY screen — even well-designed pages have issues. Common UX friction includes:
- Unclear labels, ambiguous CTAs, or confusing terminology
- Too many options or visual clutter making the next step unclear
- Missing information (price, size, availability) that forces extra clicks
- Unexpected layouts, hidden navigation, or unfamiliar interaction patterns
- Slow-feeling flows that require too many steps for a simple task
- Pop-ups, overlays, or interruptions (cookie banners, newsletter modals, app install prompts)
- Poor search results, irrelevant recommendations, or hard-to-find categories
- Tiny text, low contrast, or elements that are hard to notice

A friction score of 0.0 should be extremely rare — reserve it only for screens that are absolutely flawless for your persona. Most screens should score at least 0.3-0.5 friction. Screens with any real obstacle should score 0.6+. Be dramatic — real users are far more frustrated than designers expect.

Remember: your scores should reflect YOUR persona's tolerances with strong differentiation between personas. If you are impatient, even small delays or extra clicks should push friction to 0.5+. If you have high frustration sensitivity, ambiguous elements should push friction to 0.6+. If you are unforgiving of bad UX, any confusion should score at least 0.5. Conversely, if you are patient and forgiving, you can score lower — the point is that different personas should produce noticeably different scores for the same screen.

IMPORTANT: The screenshot and element list only show what is currently visible in the viewport. If the page is taller than the viewport, there is more content above or below that you haven't seen yet. Check the scroll position above — if you haven't seen the full page and can't find what you need, consider scrolling down before concluding something is missing.

Pick ONE concrete browser action to execute:
- click: click an interactive element by index number. Only works for elements in the viewport. Requires: { "type": "click", "elementIndex": <number> }
- type: type text into an input field. Requires: { "type": "type", "elementIndex": <number>, "text": "<string>", "submit": true|false }. Default to "submit": true — always press Enter after typing to submit the form/search. Only set "submit": false if you specifically need to type without submitting (e.g. filling one field in a multi-field form before moving to the next).
- scroll: explore unseen content above or below the current viewport. Each scroll moves ~65% of the viewport. Requires: { "type": "scroll", "direction": "up" | "down" }
- scroll_to: scroll a specific element into the center of the viewport. Use when the element list shows a specific element below or above the viewport that you want to reach. More precise than repeated scroll actions. Requires: { "type": "scroll_to", "elementIndex": <number> }
- navigate_back: go back to the previous page. Requires: { "type": "navigate_back" }
- wait: wait for the page to load. Requires: { "type": "wait", "reason": "<string>" }
- done: STOP — the goal has been achieved (success=true) or you are giving up (success=false). Choose this IMMEDIATELY when the goal is met. Do not take any additional actions after the goal is complete. Requires: { "type": "done", "success": true|false, "reason": "<string>" }

CLICK STRATEGY:
- On product listing/search results pages, click the product TITLE or NAME link to navigate to the product detail page. Do NOT click product images or thumbnails — these often open a zoom lightbox or image gallery overlay instead of navigating to the product page.
- On product detail pages, look for "Add to Cart/Bag" buttons, size selectors, and quantity controls.
- Prefer text links and labeled buttons over image elements when both lead to the same destination.

SCROLL STRATEGY:
- Use "scroll" (direction) to explore unknown content beyond the viewport.
- Use "scroll_to" (elementIndex) when the element list shows a specific element below or above the viewport that you want to reach. This is precise — no overscrolling.
- Do NOT click elements listed below or above the viewport — they are off-screen. Scroll to them first using scroll_to, then click on the next step.
- Don't waste steps scrolling through an entire long page. If you've scrolled a few times and can't find what you need, try navigating back or using a different approach.

Also provide an abstract "intent" for report compatibility: one of CLICK_PRIMARY_CTA, CLICK_SECONDARY_CTA, OPEN_NAV, SCROLL, BACK, SEEK_INFO, HESITATE, ABANDON.

Friction scale (use the FULL range — don't cluster everything around 0.3-0.5):
- 0.0-0.1: Genuinely flawless — instant clarity, zero thought required (almost never appropriate)
- 0.2-0.3: Smooth but imperfect — minor label or layout nit, barely noticeable
- 0.4-0.5: Real friction — had to pause and think, one genuine confusion
- 0.6-0.7: Frustrating — multiple issues, unclear path, patience tested
- 0.8-1.0: Broken experience — lost, confused, angry, ready to leave

Dropoff risk scale (use the FULL range — match it to your persona's tolerance):
- 0.0-0.1: Fully engaged, would definitely continue
- 0.2-0.3: Mildly annoyed but pushing through
- 0.4-0.5: Patience wearing thin, considering alternatives
- 0.6-0.7: One more frustration and I'm gone
- 0.8-1.0: Actively looking for the exit / would abandon right now

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
  "memoryUpdate": "optional note to carry forward",
  "completesGoal": false
}

IMPORTANT: Set "completesGoal": true when the action you are choosing will directly achieve the goal. For example, clicking "Add to Cart" when the goal is to add an item to cart. When completesGoal is true, the action will be executed and the episode ends immediately as successful — no further steps needed.`;
}

export async function handleSimulateAgentEpisode(job: SimulateAgentEpisodeJob) {
  const tag = `[agent_episode:${job.episodeId.slice(0, 8)}]`;
  console.log(`${tag} Starting — run=${job.runId.slice(0, 8)} model=${job.model} url=${job.url}`);

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

  const llm = createLLMProvider(job.model);
  const personaContext = buildPersonaContext(episode.persona);

  let episodeStatus: "COMPLETED" | "ABANDONED" | "FAILED" | "CANCELLED" = "COMPLETED";
  let memory: string | null = null;
  let prevUrl = "";
  let stuckCount = 0;
  let lastActionWasInteraction = false; // typing/clicking counts as progress even if URL didn't change
  let forcedScrollCount = 0;
  const MAX_FORCED_SCROLLS = 3; // don't force more than 3 scrolls before allowing abandon
  let consecutiveOverlayCount = 0; // how many steps in a row had an overlay without a URL change
  const MAX_CONSECUTIVE_OVERLAYS = 6; // force abandon if stuck dismissing the same modal
  let urlAtStepStart = ""; // URL as of the END of the previous step — for overlay loop detection

  // Check cancellation BEFORE creating container to avoid wasting resources
  if (await isRunCancelled(job.runId)) {
    console.log(`${tag} Run already cancelled before container start, skipping`);
    await prisma.episode.update({
      where: { id: episode.id },
      data: { status: "CANCELLED" },
    });
    await checkAndAdvanceRun(job.runId);
    return;
  }

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

      // Capture URL before prevUrl is updated — used for overlay loop detection below
      const urlChangedThisStep = currentUrl !== urlAtStepStart;

      // Track stuck detection — typing/clicking always counts as progress
      if (currentUrl !== prevUrl) {
        stuckCount = 0;
        prevUrl = currentUrl;
      } else if (lastActionWasInteraction) {
        stuckCount = 0; // gave the page a chance to react; don't penalise
      } else {
        stuckCount++;
      }
      lastActionWasInteraction = false;

      // Force abandon if stuck too long
      if (stuckCount >= MAX_STUCK_COUNT) {
        console.log(`${tag} Step ${stepIdx}: stuck on ${currentUrl} for ${stuckCount} actions, forcing abandon`);
        episodeStatus = "ABANDONED";
        break;
      }

      // Check for run cancellation
      if (await isRunCancelled(job.runId)) {
        console.log(`${tag} Step ${stepIdx}: run cancelled, stopping episode`);
        episodeStatus = "CANCELLED";
        break;
      }

      // Detect overlays/modals so we can inform the agent (but don't auto-dismiss —
      // the agent needs to see confirmation modals like "Added to Cart" to know the goal succeeded)
      let overlayDetected = false;
      try {
        overlayDetected = await session.detectOverlay();
        if (overlayDetected) {
          console.log(`${tag} Step ${stepIdx}: overlay/modal detected — agent will see it in screenshot`);
        }
      } catch {
        // Non-critical — continue without overlay info
      }

      // Track consecutive overlay steps without URL change — if the agent keeps
      // dismissing the same blocking modal without navigating, force abandon.
      // Uses urlAtStepStart (URL at end of previous step) so a URL change this step resets the count.
      if (overlayDetected && !urlChangedThisStep) {
        consecutiveOverlayCount++;
      } else {
        consecutiveOverlayCount = 0;
      }
      if (consecutiveOverlayCount >= MAX_CONSECUTIVE_OVERLAYS) {
        console.log(`${tag} Step ${stepIdx}: modal loop detected (${consecutiveOverlayCount} consecutive overlays on ${currentUrl}) — forcing ABANDONED`);
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

      // Get viewport size for element extraction
      const vp = session.page!.viewportSize() ?? { width: 1280, height: 800 };

      // Extract interactive elements with viewport awareness
      let elements: InteractiveElement[] = [];
      try {
        elements = await extractInteractiveElements(session.page!, vp.height);
      } catch (err) {
        console.warn(`${tag} Step ${stepIdx}: element extraction failed:`, err);
      }
      const elementList = formatElementList(elements, vp.height);

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
        overlayDetected,
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

        // Detailed reasoning log
        const act = reasoning.browserAction;
        const actDetail = act.type === "click" ? `click[${act.elementIndex}]`
          : act.type === "type" ? `type[${act.elementIndex}] "${act.text?.slice(0, 30)}"`
          : act.type === "scroll" ? `scroll_${act.direction}`
          : act.type === "scroll_to" ? `scroll_to[${act.elementIndex}]`
          : act.type === "done" ? `done(success=${act.success})`
          : act.type;
        console.log(`${tag} Step ${stepIdx}: action=${actDetail} intent=${reasoning.intent} friction=${reasoning.friction.toFixed(2)} confidence=${reasoning.confidence.toFixed(2)} dropoff=${reasoning.dropoffRisk.toFixed(2)}`);
        console.log(`${tag} Step ${stepIdx}: salient="${reasoning.salient?.slice(0, 100)}"`);
        if (reasoning.confusions?.length) {
          console.log(`${tag} Step ${stepIdx}: ${reasoning.confusions.length} confusion(s): ${reasoning.confusions.map(c => c.issue.slice(0, 60)).join(" | ")}`);
        }
        if (reasoning.memoryUpdate) {
          console.log(`${tag} Step ${stepIdx}: memory="${reasoning.memoryUpdate.slice(0, 100)}"`);
        }
        console.log(`${tag} Step ${stepIdx}: url=${currentUrl} title="${pageTitle?.slice(0, 50)}" scroll=${scrollInfo.scrollY}/${scrollInfo.pageHeight} (${Math.round(((scrollInfo.scrollY + scrollInfo.viewportHeight) / scrollInfo.pageHeight) * 100)}%)`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`${tag} Step ${stepIdx} LLM FAILED: ${msg}`);
        episodeStatus = "FAILED";
        break;
      }

      // Upsert StepTrace — use upsert so stalled-job retries don't crash on
      // the unique (episodeId, stepIndex) constraint when replaying from step 0.
      await prisma.stepTrace.upsert({
        where: { episodeId_stepIndex: { episodeId: episode.id, stepIndex: stepIdx } },
        create: {
          episodeId: episode.id,
          stepIndex: stepIdx,
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
        update: {
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

      // Guard: prevent premature abandonment if page hasn't been sufficiently viewed.
      // Capped at MAX_FORCED_SCROLLS to avoid burning all steps scrolling long pages.
      if (reasoning.browserAction.type === "done" && !reasoning.browserAction.success) {
        const bottomEdge = scrollInfo.scrollY + scrollInfo.viewportHeight;
        const pctSeen = Math.min(1, bottomEdge / scrollInfo.pageHeight);
        const hasSeenEnough = pctSeen >= 0.5 || forcedScrollCount >= MAX_FORCED_SCROLLS;
        if (!hasSeenEnough) {
          const unseen = scrollInfo.pageHeight - bottomEdge;
          forcedScrollCount++;
          console.log(`${tag} Step ${stepIdx}: agent wants to abandon but only ${Math.round(pctSeen * 100)}% seen (${unseen}px unseen) — forcing scroll (${forcedScrollCount}/${MAX_FORCED_SCROLLS})`);
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

      // Safety: scroll_to with out-of-range element → fall back to scroll down
      if (reasoning.browserAction.type === "scroll_to") {
        const targetEl = elements[reasoning.browserAction.elementIndex];
        if (!targetEl) {
          console.log(`${tag} Step ${stepIdx}: scroll_to element ${reasoning.browserAction.elementIndex} out of range, falling back to scroll down`);
          await session.executeAction({ type: "scroll", direction: "down" as const }, elements);
          continue;
        }
      }

      // Execute the browser action
      try {
        await session.executeAction(reasoning.browserAction, elements);
        const actionType = reasoning.browserAction.type;
        if (actionType === "type" || actionType === "click") {
          lastActionWasInteraction = true;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`${tag} Step ${stepIdx}: action execution failed: ${msg}`);
        // Continue — the page might still be usable
      }

      // Early exit: if the LLM says this action completes the goal, we're done
      if (reasoning.completesGoal) {
        console.log(`${tag} Step ${stepIdx}: completesGoal=true — ending episode as COMPLETED`);
        episodeStatus = "COMPLETED";
        break;
      }

      // Record URL after action for overlay loop detection next step
      urlAtStepStart = await session.getUrl();
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
  const agJob: AggregateReportJob = { runId };
  await aggregateQueue.add(QUEUE_NAMES.AGGREGATE_REPORT, agJob);
  await aggregateQueue.close();
  console.log(`${rtag} Aggregation job enqueued`);
}
