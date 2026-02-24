/**
 * PersonaLab Worker — Integration Test Suite
 *
 * Tests each layer independently so failures are easy to pinpoint:
 *   1. Browser basics  (launch, navigate, screenshot, close)
 *   2. Element extraction
 *   3. Overlay detection
 *   4. Scroll info
 *   5. LLM JSON completion
 *   6. LLM vision reasoning
 *   7. Full agent mini-episode (example.com)
 *
 * Run: pnpm --filter @persona-lab/worker test
 */

import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

import { BrowserSession } from "../lib/browser/session.js";
import {
  extractInteractiveElements,
  formatElementList,
} from "../lib/browser/extract-elements.js";
import { createLLMProvider } from "../lib/llm/openrouter-provider.js";
import { AgentReasoningOutput } from "@persona-lab/shared";
import { z } from "zod";

// ─── Test runner ─────────────────────────────────────────────────────────────

type Result = { name: string; passed: boolean; ms: number; error?: string };
const results: Result[] = [];

const RESET = "\x1b[0m";
const BOLD  = "\x1b[1m";
const GREEN = "\x1b[32m";
const RED   = "\x1b[31m";
const CYAN  = "\x1b[36m";
const DIM   = "\x1b[2m";

function section(label: string) {
  console.log(`\n${BOLD}${CYAN}── ${label} ${"─".repeat(Math.max(0, 55 - label.length))}${RESET}`);
}

function log(label: string, msg: string) {
  console.log(`  ${DIM}[${label}]${RESET} ${msg}`);
}

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  console.log(`\n${BOLD}▶ ${name}${RESET}`);
  const t0 = Date.now();
  try {
    await fn();
    const ms = Date.now() - t0;
    console.log(`  ${GREEN}✅ PASSED${RESET} ${DIM}(${ms}ms)${RESET}`);
    results.push({ name, passed: true, ms });
  } catch (err) {
    const ms = Date.now() - t0;
    const error = err instanceof Error ? err.message : String(err);
    console.error(`  ${RED}❌ FAILED${RESET} ${DIM}(${ms}ms)${RESET}`);
    console.error(`  ${RED}${error}${RESET}`);
    if (err instanceof Error && err.stack) {
      console.error(DIM + err.stack.split("\n").slice(1, 4).join("\n") + RESET);
    }
    results.push({ name, passed: false, ms, error });
  }
}

// ─── Helper ──────────────────────────────────────────────────────────────────

async function withBrowser(
  headless: boolean,
  fn: (session: BrowserSession) => Promise<void>
): Promise<void> {
  const session = new BrowserSession();
  try {
    await session.launch({ headless });
    await fn(session);
  } finally {
    await session.close().catch(() => {});
  }
}

// ─── Test URLs ───────────────────────────────────────────────────────────────

const SIMPLE_URL = "https://example.com";
const AGENT_GOAL = 'Click the "More information..." link';

// ─── 1. Browser basics ───────────────────────────────────────────────────────

section("BROWSER LAYER");

await test("Browser: launch + navigate", async () => {
  await withBrowser(true, async (session) => {
    log("launch", "launching headless Chromium...");
    await session.navigate(SIMPLE_URL);
    const url = await session.getUrl();
    log("navigate", `landed on: ${url}`);
    if (!url.includes("example.com")) throw new Error(`Unexpected URL: ${url}`);
  });
});

await test("Browser: screenshot (30s timeout)", async () => {
  await withBrowser(true, async (session) => {
    await session.navigate(SIMPLE_URL);
    log("screenshot", "taking screenshot...");
    const buf = await session.screenshot();
    log("screenshot", `size: ${(buf.length / 1024).toFixed(1)} KB`);
    if (buf.length < 1_000) throw new Error("Screenshot suspiciously small (<1KB) — likely blank");
    // Save it so you can inspect it
    const outPath = path.resolve(__dirname, "../../../../debug-screenshot.png");
    fs.writeFileSync(outPath, buf);
    log("screenshot", `saved to ${outPath}`);
  });
});

await test("Browser: element extraction", async () => {
  await withBrowser(true, async (session) => {
    await session.navigate(SIMPLE_URL);
    const vp = session.page!.viewportSize() ?? { width: 1280, height: 800 };
    const elements = await extractInteractiveElements(session.page!, vp.height);
    log("elements", `found ${elements.length} interactive element(s)`);
    const formatted = formatElementList(elements, vp.height);
    log("elements", `formatted list:\n${formatted.split("\n").map((l) => "    " + l).join("\n")}`);
    if (elements.length === 0) throw new Error("No elements found — extraction broken");
  });
});

await test("Browser: overlay detection — no false positive on example.com", async () => {
  await withBrowser(true, async (session) => {
    await session.navigate(SIMPLE_URL);
    const overlay = await session.detectOverlay();
    log("overlay", `detected: ${overlay}`);
    if (overlay) throw new Error("False positive — overlay detected on a clean page");
  });
});

await test("Browser: scroll info", async () => {
  await withBrowser(true, async (session) => {
    await session.navigate(SIMPLE_URL);
    const info = await session.getScrollInfo();
    log("scroll", `scrollY=${info.scrollY} viewport=${info.viewportHeight}px page=${info.pageHeight}px`);
    if (info.viewportHeight <= 0) throw new Error("Invalid viewport height");
    if (info.pageHeight <= 0) throw new Error("Invalid page height");
  });
});

await test("Browser: click action (click More information link)", async () => {
  await withBrowser(true, async (session) => {
    await session.navigate(SIMPLE_URL);
    const vp = session.page!.viewportSize() ?? { width: 1280, height: 800 };
    const elements = await extractInteractiveElements(session.page!, vp.height);
    log("click", `${elements.length} elements found`);
    // example.com has exactly one link — click index 0
    if (elements.length === 0) throw new Error("No elements to click");
    await session.executeAction({ type: "click", elementIndex: 0 }, elements);
    const newUrl = await session.getUrl();
    log("click", `after click, url=${newUrl}`);
    if (newUrl === SIMPLE_URL) throw new Error("URL did not change after clicking a link");
  });
});

// ─── 2. LLM layer ────────────────────────────────────────────────────────────

section("LLM LAYER");

await test("LLM: JSON completion (smoke test)", async () => {
  if (!process.env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not set");
  const llm = createLLMProvider("google/gemini-2.5-flash");
  const schema = z.object({ greeting: z.string(), number: z.number() });
  log("llm", "calling LLM...");
  const res = await llm.completeJSON(
    'Respond with valid JSON: { "greeting": "hello", "number": 42 }',
    schema
  );
  log("llm", `response: ${JSON.stringify(res)}`);
  if (!res.greeting) throw new Error("Missing greeting field");
  if (typeof res.number !== "number") throw new Error("Missing number field");
});

await test("LLM: vision reasoning on screenshot of example.com", async () => {
  if (!process.env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not set");
  await withBrowser(true, async (session) => {
    await session.navigate(SIMPLE_URL);
    const vp = session.page!.viewportSize() ?? { width: 1280, height: 800 };
    const elements = await extractInteractiveElements(session.page!, vp.height);
    const elementList = formatElementList(elements, vp.height);
    const scrollInfo = await session.getScrollInfo();
    const screenshot = await session.screenshot();
    log("llm", `screenshot: ${(screenshot.length / 1024).toFixed(1)}KB, elements: ${elements.length}`);

    const llm = createLLMProvider("google/gemini-2.5-flash");
    const rawSchema = z.record(z.unknown());
    const prompt = `You are a UX tester persona. Goal: "${AGENT_GOAL}"
Step 1 of 5. URL: ${SIMPLE_URL}
Page scroll: ${scrollInfo.scrollY}/${scrollInfo.pageHeight}px

Interactive elements:
${elementList}

[screenshot attached]

Respond as JSON:
{
  "salient": "what stands out on this screen",
  "confusions": [],
  "browserAction": { "type": "click", "elementIndex": 0 },
  "intent": "CLICK_PRIMARY_CTA",
  "confidence": 0.9,
  "friction": 0.1,
  "dropoffRisk": 0.05,
  "completesGoal": true
}`;
    log("llm", "sending screenshot + prompt to LLM...");
    const raw = await llm.completeJSONWithImage(screenshot, prompt, rawSchema);
    log("llm", `raw output keys: ${Object.keys(raw as object).join(", ")}`);
    const parsed = AgentReasoningOutput.parse(raw);
    log("llm", `action=${parsed.browserAction.type} friction=${parsed.friction} confidence=${parsed.confidence} completesGoal=${parsed.completesGoal}`);
    log("llm", `salient: "${parsed.salient.slice(0, 100)}"`);
  });
});

// ─── 3. Full agent episode ────────────────────────────────────────────────────

section("FULL AGENT EPISODE");

await test("Agent: full episode on example.com (visible browser)", async () => {
  if (!process.env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not set");

  const session = new BrowserSession();
  const llm = createLLMProvider("google/gemini-2.5-flash");
  const MAX_STEPS = 6;
  let episodeResult: "COMPLETED" | "ABANDONED" | "FAILED" | "RUNNING" = "RUNNING";
  let urlAtStepStart = "";
  let consecutiveOverlayCount = 0;

  try {
    log("episode", "launching visible browser...");
    await session.launch({ headless: false });
    await session.navigate(SIMPLE_URL);
    log("episode", `navigated to ${SIMPLE_URL}`);

    for (let stepIdx = 0; stepIdx < MAX_STEPS; stepIdx++) {
      const currentUrl = await session.getUrl();
      const pageTitle = await session.getTitle();
      const urlChangedThisStep = currentUrl !== urlAtStepStart;

      log("episode", `── Step ${stepIdx} ──────────────────────────────`);
      log("episode", `url=${currentUrl}`);
      log("episode", `title="${pageTitle}"`);
      log("episode", `urlChanged=${urlChangedThisStep}`);

      // Overlay detection + loop guard
      let overlayDetected = false;
      try {
        overlayDetected = await session.detectOverlay();
        log("episode", `overlay=${overlayDetected}`);
      } catch {
        log("episode", "overlay detection failed (non-fatal)");
      }

      if (overlayDetected && !urlChangedThisStep) {
        consecutiveOverlayCount++;
        log("episode", `consecutiveOverlayCount=${consecutiveOverlayCount}`);
        if (consecutiveOverlayCount >= 6) {
          log("episode", "MODAL LOOP — forcing ABANDONED");
          episodeResult = "ABANDONED";
          break;
        }
      } else {
        consecutiveOverlayCount = 0;
      }

      // Screenshot
      log("episode", "taking screenshot...");
      const screenshot = await session.screenshot();
      log("episode", `screenshot: ${(screenshot.length / 1024).toFixed(1)} KB`);

      // Element extraction
      const vp = session.page!.viewportSize() ?? { width: 1280, height: 800 };
      const elements = await extractInteractiveElements(session.page!, vp.height);
      const elementList = formatElementList(elements, vp.height);
      const scrollInfo = await session.getScrollInfo();
      log("episode", `elements: ${elements.length} (${elements.filter((e) => e.inViewport).length} in viewport)`);
      log("episode", `scroll: ${scrollInfo.scrollY}/${scrollInfo.pageHeight}px`);

      // LLM reasoning
      const rawSchema = z.record(z.unknown());
      const prompt = `You are a UX tester. Goal: "${AGENT_GOAL}"
Step ${stepIdx + 1} of ${MAX_STEPS}. URL: ${currentUrl}
Page: ${scrollInfo.scrollY}–${scrollInfo.scrollY + scrollInfo.viewportHeight}px of ${scrollInfo.pageHeight}px total

Elements:
${elementList}

[screenshot attached]

Respond as JSON:
{
  "salient": "...",
  "confusions": [],
  "browserAction": { "type": "click", "elementIndex": 0 },
  "intent": "CLICK_PRIMARY_CTA",
  "confidence": 0.9,
  "friction": 0.1,
  "dropoffRisk": 0.05,
  "completesGoal": false
}

Set completesGoal=true if clicking this element will directly achieve the goal.
Set browserAction.type="done" with success=true once goal is achieved.`;

      log("episode", "calling LLM...");
      const raw = await llm.completeJSONWithImage(screenshot, prompt, rawSchema);
      const parsed = AgentReasoningOutput.parse(raw);

      const act = parsed.browserAction;
      const actStr =
        act.type === "click" ? `click[${act.elementIndex}]`
        : act.type === "type" ? `type[${act.elementIndex}] "${act.text?.slice(0, 20)}"`
        : act.type === "done" ? `done(success=${act.success})`
        : act.type;

      log("episode", `action=${actStr} intent=${parsed.intent} friction=${parsed.friction.toFixed(2)} confidence=${parsed.confidence.toFixed(2)} completesGoal=${parsed.completesGoal}`);
      log("episode", `salient: "${parsed.salient.slice(0, 120)}"`);
      if (parsed.confusions?.length) {
        log("episode", `confusions: ${parsed.confusions.map((c) => c.issue.slice(0, 80)).join(" | ")}`);
      }

      // Done?
      if (act.type === "done") {
        episodeResult = act.success ? "COMPLETED" : "ABANDONED";
        log("episode", `done — ${episodeResult}: ${act.reason}`);
        break;
      }

      // Execute action
      try {
        await session.executeAction(parsed.browserAction, elements);
        log("episode", "action executed");
      } catch (err) {
        log("episode", `action failed (non-fatal): ${err instanceof Error ? err.message : err}`);
      }

      // completesGoal = execute then stop
      if (parsed.completesGoal) {
        log("episode", "completesGoal=true — stopping as COMPLETED");
        episodeResult = "COMPLETED";
        break;
      }

      // Record URL for next step's overlay check
      urlAtStepStart = await session.getUrl();
    }

    if (episodeResult === "RUNNING") {
      log("episode", "reached max steps without completion — marking ABANDONED");
      episodeResult = "ABANDONED";
    }

    log("episode", `final result: ${episodeResult}`);

  } finally {
    await session.close().catch(() => {});
  }
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${BOLD}${"═".repeat(60)}${RESET}`);
console.log(`${BOLD}TEST SUMMARY${RESET}`);
console.log(`${"═".repeat(60)}`);

const passed = results.filter((r) => r.passed).length;
const failed = results.filter((r) => !r.passed).length;

for (const r of results) {
  const icon = r.passed ? `${GREEN}✅${RESET}` : `${RED}❌${RESET}`;
  const timing = `${DIM}(${r.ms}ms)${RESET}`;
  const err = r.error ? ` ${RED}— ${r.error.slice(0, 80)}${RESET}` : "";
  console.log(`${icon} ${r.name} ${timing}${err}`);
}

console.log(`\n${passed === results.length ? GREEN : RED}${BOLD}${passed}/${results.length} passed${RESET}, ${failed} failed\n`);

if (failed > 0) process.exit(1);
