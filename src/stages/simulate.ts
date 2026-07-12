/**
 * [INPUT]: depends on lib/hash's hashString/mulberry32, on types.ts's SimulatedCurve/AngleType/NamedAsset
 * [OUTPUT]: exports runSimulate(namedAsset, angleType, days, waveNumber) -> SimulatedCurve
 * [POS]: station 7 of the nine-station pipeline, where the honest boundary lives — market response is simulated, three response models map to three angleTypes
 * [PROTOCOL]: update this header on change, then check CLAUDE.md
 */
import { hashString, mulberry32 } from "../lib/hash.js";
import type { AngleType, NamedAsset, SimulatedCurve } from "../types.js";

const NOISE_AMPLITUDE = 0.004;

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

// moment type: peaks then decays exponentially. Ramps linearly for peakDay days, then exponential decay.
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

// evergreen type: a steady logarithmic climb, independent of topical heat, more stable the longer it runs
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

// ugc-loop type: compounds wave over wave, the higher the wave number the stronger the boost (built to snowball)
function ugcLoopCurve(days: number, rng: () => number, waveNumber: number): number[] {
  const baseCTR = 0.022;
  const weeklyCompound = 1 + 0.05 * waveNumber; // boost scales with wave number
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
