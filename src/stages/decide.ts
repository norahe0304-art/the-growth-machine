/**
 * [INPUT]: 依赖 types.ts 的 SimulatedCurve/Plan/Decision/Verdict，无 LLM 参与
 * [OUTPUT]: 对外提供 runDecide(curve, plan) -> Decision，规则引擎，用预注册阈值判 SCALE/KILL/ITERATE
 * [POS]: 六站流水线第 8 站，是 simulate 曲线到机器判决的纯规则转换 —— 阈值来自 plan 站预注册的常量表
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { Decision, Plan, SimulatedCurve } from "../types.js";

// 末段斜率: 用最后 7 天做简单线性回归，判断疲劳趋势
function tailSlope(series: number[], window = 7): number {
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
    reason = `末3日均CTR ${ctr.toFixed(4)} 达到预注册 scaleAt ${thresholds.scaleAt}，判定放大`;
  } else if (ctr <= thresholds.killAt) {
    verdict = "KILL";
    reason = `末3日均CTR ${ctr.toFixed(4)} 低于预注册 killAt ${thresholds.killAt}，判定砍掉`;
  } else if (slope <= thresholds.fatigueSlope) {
    verdict = "KILL";
    reason = `末7日斜率 ${slope.toFixed(5)} 触发预注册 fatigueSlope ${thresholds.fatigueSlope}，疲劳信号判定砍掉`;
  } else {
    verdict = "ITERATE";
    reason = `末3日均CTR ${ctr.toFixed(4)} 处于 killAt/scaleAt 之间，斜率未触发疲劳阈值，判定迭代`;
  }

  return {
    variantId: curve.variantId,
    format: curve.format,
    verdict,
    reason,
    finalCTR: ctr,
    slope,
  };
}
