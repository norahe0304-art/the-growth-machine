/**
 * [INPUT]: depends on types.ts's SimulatedCurve/Plan/Decision/Verdict/MeasuredAssetSummary/PreRegisteredThresholds, no LLM involved
 * [OUTPUT]: exports runDecide(curve, plan) -> Decision (simulated path), runDecideMeasured(measured, thresholds) -> Decision (measured path), and the shared tailSlope/finalValue helpers
 * [POS]: station 8 of the ten-station pipeline, the pure-rules conversion from a curve to a machine verdict: thresholds come from the preregistered constant tables in plan.ts
 * [PROTOCOL]: update this header on change, then check CLAUDE.md
 */
import type { Decision, MeasuredAssetSummary, Plan, PreRegisteredThresholds, SimulatedCurve } from "../types.js";

// tail slope: a simple linear regression over the last `window` points, to gauge fatigue trend
export function tailSlope(series: number[], window = 7): number {
  const tail = series.slice(-window);
  const n = tail.length;
  if (n < 2) return 0;
  const xs = Array.from({ length: n }, (_, i) => i);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = tail.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (tail[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

function finalCTR(series: number[], window = 3): number {
  const tail = series.slice(-window);
  return tail.reduce((a, b) => a + b, 0) / tail.length;
}

export function runDecide(curve: SimulatedCurve, plan: Plan): Decision {
  const thresholds = plan.preRegisteredThresholds[curve.angleType];
  const ctr = finalCTR(curve.predictedCTR);
  const slope = tailSlope(curve.predictedCTR);

  let verdict: Decision["verdict"];
  let reason: string;

  if (ctr >= thresholds.scaleAt) {
    verdict = "SCALE";
    reason = `last-3-day average CTR ${ctr.toFixed(4)} reached the preregistered scaleAt ${thresholds.scaleAt}: verdict: scale`;
  } else if (ctr <= thresholds.killAt) {
    verdict = "KILL";
    reason = `last-3-day average CTR ${ctr.toFixed(4)} fell below the preregistered killAt ${thresholds.killAt}: verdict: kill`;
  } else if (slope <= thresholds.fatigueSlope) {
    verdict = "KILL";
    reason = `last-7-day slope ${slope.toFixed(5)} tripped the preregistered fatigueSlope ${thresholds.fatigueSlope}: fatigue signal, verdict: kill`;
  } else {
    verdict = "ITERATE";
    reason = `last-3-day average CTR ${ctr.toFixed(4)} sits between killAt and scaleAt, slope has not tripped the fatigue threshold: verdict: iterate`;
  }

  return {
    variantId: curve.variantId,
    format: curve.format,
    verdict,
    reason,
    finalCTR: ctr,
    slope,
    source: "simulated",
  };
}

// ============================================================
// Measured decide path: same rule shape as runDecide, but reads real
// engagementRate readings off a wave's measure.ts output instead of a
// simulated CTR curve. With fewer than 2 readings, tailSlope degrades to 0
// (no fatigue signal can fire yet): this is real data, you don't get a
// fatigue trend until you have at least two check-ins.
// ============================================================
export function runDecideMeasured(measured: MeasuredAssetSummary, thresholds: PreRegisteredThresholds): Decision {
  const series = measured.readings.map((r) => r.engagementRate);
  const rate = series.length > 0 ? series[series.length - 1] : 0;
  const slope = tailSlope(series);

  let verdict: Decision["verdict"];
  let reason: string;

  if (rate >= thresholds.scaleAt) {
    verdict = "SCALE";
    reason = `measured engagementRate ${rate.toFixed(4)} reached the preregistered scaleAt ${thresholds.scaleAt}: verdict: scale`;
  } else if (rate <= thresholds.killAt) {
    verdict = "KILL";
    reason = `measured engagementRate ${rate.toFixed(4)} fell below the preregistered killAt ${thresholds.killAt}: verdict: kill`;
  } else if (series.length >= 2 && slope <= thresholds.fatigueSlope) {
    verdict = "KILL";
    reason = `measured readings slope ${slope.toFixed(5)} tripped the preregistered fatigueSlope ${thresholds.fatigueSlope}: fatigue signal, verdict: kill`;
  } else {
    verdict = "ITERATE";
    reason = `measured engagementRate ${rate.toFixed(4)} sits between killAt and scaleAt, slope has not tripped the fatigue threshold: verdict: iterate`;
  }

  return {
    variantId: measured.variantId,
    format: measured.format,
    verdict,
    reason,
    finalCTR: rate,
    slope,
    source: "measured",
  };
}
