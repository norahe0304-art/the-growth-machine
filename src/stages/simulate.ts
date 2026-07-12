/**
 * [INPUT]: 依赖 lib/hash 的 hashString/mulberry32，依赖 types.ts 的 SimulatedCurve/AngleType/NamedAsset
 * [OUTPUT]: 对外提供 runSimulate(namedAsset, angleType, days, waveNumber) -> SimulatedCurve
 * [POS]: 六站流水线第 7 站，诚实边界所在 —— market response is simulated, 三种响应模型对应三种 angleType
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { hashString, mulberry32 } from "../lib/hash.js";
import type { AngleType, NamedAsset, SimulatedCurve } from "../types.js";

const NOISE_AMPLITUDE = 0.004;

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

// moment 型: 峰值后指数疲劳。前 peakDay 天线性爬升，此后指数衰减
function momentCurve(days: number, rng: () => number): number[] {
  const peakCTR = 0.06;
  const peakDay = 3;
  const decayRate = 0.22;
  const out: number[] = [];
  for (let d = 1; d <= days; d++) {
    const base =
      d <= peakDay ? peakCTR * (d / peakDay) : peakCTR * Math.exp(-decayRate * (d - peakDay));
    out.push(clamp01(base + (rng() - 0.5) * NOISE_AMPLITUDE));
  }
  return out;
}

// evergreen 型: 对数稳爬，不依赖话题热度，越久越稳
function evergreenCurve(days: number, rng: () => number): number[] {
  const baseCTR = 0.018;
  const growth = 0.02;
  const out: number[] = [];
  for (let d = 1; d <= days; d++) {
    const base = baseCTR + growth * (Math.log(1 + d) / Math.log(1 + days));
    out.push(clamp01(base + (rng() - 0.5) * NOISE_AMPLITUDE));
  }
  return out;
}

// ugc-loop 型: 逐波复利，wave 序号越大加成越强(越滚越大)
function ugcLoopCurve(days: number, rng: () => number, waveNumber: number): number[] {
  const baseCTR = 0.022;
  const weeklyCompound = 1 + 0.05 * waveNumber; // wave 序号加成
  const out: number[] = [];
  for (let d = 1; d <= days; d++) {
    const week = Math.floor((d - 1) / 7);
    const base = baseCTR * Math.pow(weeklyCompound, week);
    out.push(clamp01(base + (rng() - 0.5) * NOISE_AMPLITUDE));
  }
  return out;
}

function shareMultiplier(angleType: AngleType): number {
  if (angleType === "ugc-loop") return 0.9;
  if (angleType === "moment") return 0.45;
  return 0.25;
}

export function runSimulate(
  namedAsset: NamedAsset,
  angleType: AngleType,
  days: number,
  waveNumber: number
): SimulatedCurve {
  const seedKey = `${namedAsset.name}#${angleType}`;
  const seed = hashString(seedKey);
  const rng = mulberry32(seed);

  let predictedCTR: number[];
  if (angleType === "moment") predictedCTR = momentCurve(days, rng);
  else if (angleType === "evergreen") predictedCTR = evergreenCurve(days, rng);
  else predictedCTR = ugcLoopCurve(days, rng, waveNumber);

  const shareRngSeed = hashString(`${seedKey}#share`);
  const shareRng = mulberry32(shareRngSeed);
  const mult = shareMultiplier(angleType);
  const shareRate = predictedCTR.map((ctr) => clamp01(ctr * mult + (shareRng() - 0.5) * NOISE_AMPLITUDE * 0.5));

  return {
    variantId: namedAsset.variantId,
    format: namedAsset.format,
    angleType,
    days,
    predictedCTR,
    shareRate,
    seed: String(seed),
  };
}
