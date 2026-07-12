/**
 * [INPUT]: depends on node:test/node:assert, on src/stages/decide.ts's runDecide, on src/stages/plan.ts's PRE_REGISTERED_THRESHOLDS
 * [OUTPUT]: unit tests for the decide station's threshold boundaries (SCALE/KILL/ITERATE paths + the fatigue path)
 * [POS]: part of test/, covers whether the rules engine correctly enforces the "preregistered thresholds"
 * [PROTOCOL]: update this header on change, then check CLAUDE.md
 */
import test from "node:test";
import assert from "node:assert/strict";
import { runDecide } from "../src/stages/decide.js";
import { PRE_REGISTERED_THRESHOLDS, ENGAGEMENT_THRESHOLDS } from "../src/stages/plan.js";
import type { Plan, SimulatedCurve } from "../src/types.js";

const plan: Plan = {
  moment: "test moment",
  waveNumber: 1,
  arms: [],
  preRegisteredThresholds: PRE_REGISTERED_THRESHOLDS,
  engagementThresholds: ENGAGEMENT_THRESHOLDS,
  dates: { start: "2026-01-01", end: "2026-01-21", days: 21 },
  rationale: "test plan",
};

function curveWithTail(tail: number[]): SimulatedCurve {
  const filler = new Array(21 - tail.length).fill(tail[0]);
  return {
    variantId: "v1",
    format: "still",
    angleType: "moment",
    days: 21,
    predictedCTR: [...filler, ...tail],
    shareRate: [...filler, ...tail].map((v) => v * 0.4),
    seed: "0",
  };
}

test("decide: CTR reaches scaleAt -> SCALE", () => {
  const curve = curveWithTail([0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05]);
  const decision = runDecide(curve, plan);
  assert.equal(decision.verdict, "SCALE");
  assert.equal(decision.source, "simulated");
});

test("decide: CTR falls below killAt -> KILL", () => {
  const curve = curveWithTail([0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01]);
  const decision = runDecide(curve, plan);
  assert.equal(decision.verdict, "KILL");
});

test("decide: CTR in the middle band but tail slope trips fatigueSlope -> KILL (fatigue signal)", () => {
  // last 7 days decline at -0.005/day, slope = -0.005 <= fatigueSlope(-0.004)
  // last-3-day average sits between killAt(0.015) and scaleAt(0.045)
  const tail = [0.05, 0.045, 0.04, 0.035, 0.03, 0.025, 0.02];
  const curve = curveWithTail(tail);
  const decision = runDecide(curve, plan);
  assert.equal(decision.verdict, "KILL");
  assert.ok(decision.reason.includes("fatigue"), `reason should mention the fatigue signal: ${decision.reason}`);
});

test("decide: CTR in the middle band with a flat slope -> ITERATE", () => {
  const tail = [0.025, 0.025, 0.025, 0.025, 0.025, 0.025, 0.025];
  const curve = curveWithTail(tail);
  const decision = runDecide(curve, plan);
  assert.equal(decision.verdict, "ITERATE");
});

test("decide: finalCTR and slope are passed through correctly", () => {
  const curve = curveWithTail([0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03]);
  const decision = runDecide(curve, plan);
  assert.ok(Math.abs(decision.finalCTR - 0.03) < 1e-9);
  assert.ok(Math.abs(decision.slope) < 1e-9);
});
