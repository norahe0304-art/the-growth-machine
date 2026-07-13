/**
 * [INPUT]: depends on node:test/node:assert, on src/lib/report.ts's renderReport, on src/types.ts's WaveReadout and sub-types
 * [OUTPUT]: unit tests for report.html's judge block: a fourth brandFit row renders only when
 *   score.brandFit is present, so pre-brandFit waves (score has only onBrief/legible/shareable)
 *   re-render at exactly three rows and never throw
 * [POS]: part of test/, covers the report-rendering half of the brandFit type-shape debt this
 *   lane closes (see src/stages/judge.ts and src/types.ts)
 * [PROTOCOL]: update this header on change, then check CLAUDE.md
 */
import test from "node:test";
import assert from "node:assert/strict";
import { renderReport } from "../src/lib/report.js";
import type { Brief, JudgeResult, NamedAsset, Plan, ProducedAsset, Variant, WaveReadout } from "../src/types.js";

const variant: Variant = {
  id: "v1",
  asset: "a mug",
  assetKind: "thing",
  newElement: "steam shaped like a wave",
  angle: "everyday mug meets big wave",
  angleType: "moment",
  workingTitle: "Mug Wave",
};

const brief: Brief = {
  variantId: "v1",
  workingTitle: "Mug Wave",
  audience: "test audience",
  insight: "test insight",
  assetXElement: "a mug x steam shaped like a wave",
  formats: ["still", "motion"],
  successMetric: "48-hour share rate",
  generationPrompts: { image: "image prompt", motion: "motion prompt", copy: "copy prompt" },
};

const stillNamed: NamedAsset = { variantId: "v1", format: "still", name: "WEB_CONV_TOF_HOT_STIL_HOOK_MOMENT_PERS_V01", segments: {} };
const motionNamed: NamedAsset = { variantId: "v1", format: "motion", name: "WEB_CONV_TOF_HOT_MOTI_HOOK_MOMENT_PERS_V01", segments: {} };

const stillProduced: ProducedAsset = {
  variantId: "v1",
  format: "still",
  name: stillNamed.name,
  assetPath: null,
  copy: "mock copy",
  motionScript: null,
  imageModelUsed: null,
  regeneratedCount: 0,
};

const plan: Plan = {
  moment: "report test moment",
  waveNumber: 1,
  arms: [],
  preRegisteredThresholds: {
    moment: { scaleAt: 0.05, killAt: 0.01, fatigueSlope: -0.002 },
    evergreen: { scaleAt: 0.05, killAt: 0.01, fatigueSlope: -0.002 },
    "ugc-loop": { scaleAt: 0.05, killAt: 0.01, fatigueSlope: -0.002 },
  },
  engagementThresholds: {
    moment: { scaleAt: 0.05, killAt: 0.01, fatigueSlope: -0.002 },
    evergreen: { scaleAt: 0.05, killAt: 0.01, fatigueSlope: -0.002 },
    "ugc-loop": { scaleAt: 0.05, killAt: 0.01, fatigueSlope: -0.002 },
  },
  dates: { start: "2026-01-01", end: "2026-01-21", days: 21 },
  rationale: "report test plan",
};

function readoutWithJudge(judged: JudgeResult[]): WaveReadout {
  return {
    moment: "report test moment",
    waveNumber: 1,
    variants: [variant],
    briefs: [brief],
    namedAssets: [stillNamed, motionNamed],
    plan,
    produced: [stillProduced],
    judged,
    simulated: [],
    decided: [],
    measured: [],
    rollouts: [],
    injectedLearnings: null,
  };
}

test("report: judge block renders a fourth brand-fit row when score.brandFit is present", async () => {
  const readout = readoutWithJudge([
    { variantId: "v1", format: "still", score: { onBrief: 3, legible: 2, shareable: 3, brandFit: 3 }, passed: true, regenerated: false, notes: "" },
  ]);
  const html = await renderReport(readout);
  assert.match(html, /brand fit/);
  assert.match(html, /on brief/);
});

test("report: judge block stays at three rows, no throw, when score carries no brandFit (pre-brandFit wave)", async () => {
  const readout = readoutWithJudge([
    { variantId: "v1", format: "still", score: { onBrief: 3, legible: 2, shareable: 3 }, passed: true, regenerated: false, notes: "" },
  ]);
  const html = await renderReport(readout);
  assert.doesNotMatch(html, /brand fit/);
  assert.match(html, /on brief/);
});
