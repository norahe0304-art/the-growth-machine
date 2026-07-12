/**
 * [INPUT]: 依赖 node:test/node:assert，依赖 src/stages/decide.ts 的 runDecide，依赖 src/stages/plan.ts 的 PRE_REGISTERED_THRESHOLDS
 * [OUTPUT]: 对外提供 decide 站的阈值边界单测(SCALE/KILL/ITERATE 三条路径 + fatigue 疲劳路径)
 * [POS]: test/ 的一员，覆盖"预注册阈值"是否被规则引擎正确执行
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from "node:test";
import assert from "node:assert/strict";
import { runDecide } from "../src/stages/decide.js";
import { PRE_REGISTERED_THRESHOLDS } from "../src/stages/plan.js";
import type { Plan, SimulatedCurve } from "../src/types.js";

const plan: Plan = {
  moment: "test moment",
  waveNumber: 1,
  arms: [],
  preRegisteredThresholds: PRE_REGISTERED_THRESHOLDS,
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

test("decide: CTR 达到 scaleAt -> SCALE", () => {
  const curve = curveWithTail([0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05]);
  const decision = runDecide(curve, plan);
  assert.equal(decision.verdict, "SCALE");
});

test("decide: CTR 低于 killAt -> KILL", () => {
  const curve = curveWithTail([0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01]);
  const decision = runDecide(curve, plan);
  assert.equal(decision.verdict, "KILL");
});

test("decide: CTR 处于中间但末段斜率触发 fatigueSlope -> KILL(疲劳信号)", () => {
  // 末7日以 -0.005/天 线性下降，slope = -0.005 <= fatigueSlope(-0.004)
  // 末3日均值落在 killAt(0.015) 与 scaleAt(0.045) 之间
  const tail = [0.05, 0.045, 0.04, 0.035, 0.03, 0.025, 0.02];
  const curve = curveWithTail(tail);
  const decision = runDecide(curve, plan);
  assert.equal(decision.verdict, "KILL");
  assert.ok(decision.reason.includes("疲劳"), `理由应提及疲劳信号: ${decision.reason}`);
});

test("decide: CTR 处于中间且斜率平稳 -> ITERATE", () => {
  const tail = [0.025, 0.025, 0.025, 0.025, 0.025, 0.025, 0.025];
  const curve = curveWithTail(tail);
  const decision = runDecide(curve, plan);
  assert.equal(decision.verdict, "ITERATE");
});

test("decide: finalCTR 与 slope 字段被正确回传", () => {
  const curve = curveWithTail([0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03]);
  const decision = runDecide(curve, plan);
  assert.ok(Math.abs(decision.finalCTR - 0.03) < 1e-9);
  assert.ok(Math.abs(decision.slope) < 1e-9);
});
