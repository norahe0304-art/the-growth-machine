/**
 * [INPUT]: no dependencies, pure type definitions
 * [OUTPUT]: exports the shared types that run through the nine-station pipeline —— Variant / Brief / NamedAsset / Plan / ProducedAsset / JudgeResult / SimulatedCurve / Decision / LearningEntry / measure-module types
 * [POS]: the type root of src/ — every stages/*.ts and lib/*.ts file imports from here; this is the contract between stations
 * [PROTOCOL]: update this header on change, then check CLAUDE.md
 */

// ============================================================
// Formula primitive: existing asset x one new element
// asset has two shapes: things people own / interactions people know
// ============================================================
export type AssetKind = "thing" | "interaction";

// angleType decides which response model the simulate stage picks
export type AngleType = "moment" | "evergreen" | "ugc-loop";

export interface Variant {
  id: string; // v1, v2, v3
  asset: string; // the concrete description of the existing asset
  assetKind: AssetKind;
  newElement: string; // the one new element
  angle: string; // natural-language description of the angle
  angleType: AngleType; // decides which simulate response curve family applies
  workingTitle: string;
}

export interface InsightResult {
  moment: string;
  waveNumber: number;
  variants: Variant[];
}

// ============================================================
// Brief: a one-page deliverable, generationPrompts is a first-class citizen
// ============================================================
export interface GenerationPrompts {
  image: string; // an Images API prompt that can be run as-is
  motion: string; // a motion script prompt tagged for ChatCut
  copy: string; // a copy-generation prompt
}

export interface Brief {
  variantId: string;
  workingTitle: string;
  audience: string;
  insight: string;
  assetXElement: string; // "asset x newElement" formula-shaped description
  formats: Array<"still" | "motion">;
  successMetric: string;
  generationPrompts: GenerationPrompts;
}

// ============================================================
// Naming: deterministic nine-segment name, no LLM
// ============================================================
export interface NamingInput {
  variant: Variant;
  format: "still" | "motion";
  moment: string;
  audience: string;
  version: number;
}

export interface NamedAsset {
  variantId: string;
  format: "still" | "motion";
  name: string; // CHANNEL_OBJ_FUNNEL_TEMP_FORMAT_HOOK_MOMENT_PERSONA_VER
  segments: Record<string, string>;
}

// ============================================================
// Plan: the test plan, rules + LLM hybrid
// ============================================================
export interface PreRegisteredThresholds {
  scaleAt: number; // metric reaching this value -> SCALE
  killAt: number; // metric falling below this value -> KILL
  fatigueSlope: number; // tail slope below this (more negative = more fatigued) -> KILL signal
}

export interface PlanArm {
  variantId: string;
  format: "still" | "motion";
  name: string;
  trafficSplitPct: number;
  budgetIllustrative: number; // purely illustrative, not a real media budget
}

export interface Plan {
  moment: string;
  waveNumber: number;
  arms: PlanArm[];
  preRegisteredThresholds: Record<AngleType, PreRegisteredThresholds>;
  engagementThresholds: Record<AngleType, PreRegisteredThresholds>; // measured-data decide path, engagementRate-scale thresholds
  dates: { start: string; end: string; days: number };
  rationale: string; // one LLM-generated sentence explaining the plan logic
}

// ============================================================
// Produce: the real generation deliverable
// ============================================================
export interface ProducedAsset {
  variantId: string;
  format: "still" | "motion";
  name: string;
  assetPath: string | null; // still: png/svg path; motion: null (never really rendered)
  copy: string;
  motionScript: string[] | null; // motion: three-shot storyboard
  imageModelUsed: string | null;
  regeneratedCount: number;
}

// ============================================================
// Judge: three-point self-check
// ============================================================
export interface JudgeScore {
  onBrief: 1 | 2 | 3;
  legible: 1 | 2 | 3;
  shareable: 1 | 2 | 3;
}

export interface JudgeResult {
  variantId: string;
  format: "still" | "motion";
  score: JudgeScore;
  passed: boolean; // any dimension == 1 counts as fail
  regenerated: boolean;
  notes: string;
}

// ============================================================
// Simulate: a three-week, day-level curve
// ============================================================
export interface SimulatedCurve {
  variantId: string;
  format: "still" | "motion";
  angleType: AngleType;
  days: number;
  predictedCTR: number[]; // length == days
  shareRate: number[]; // length == days
  seed: string;
}

// ============================================================
// Decide: SCALE / KILL / ITERATE
// ============================================================
export type Verdict = "SCALE" | "KILL" | "ITERATE";
export type DecisionSource = "simulated" | "measured";

export interface Decision {
  variantId: string;
  format: "still" | "motion";
  verdict: Verdict;
  reason: string; // one machine-readable sentence
  finalCTR: number; // for measured decisions, this holds the final engagementRate
  slope: number;
  source: DecisionSource;
}

// ============================================================
// Learn: cross-wave evolution
// ============================================================
export interface LearningEntry {
  wave: number;
  moment: string;
  timestamp: string;
  winners: string[]; // asset names with a SCALE verdict
  traits: string[]; // reusable traits extracted from the winners
  learnings: string; // a paragraph injected into the next wave's prompts
  sources: Record<string, DecisionSource>; // asset name -> which decide path produced its verdict
}

// ============================================================
// Measure: real channel data recorded against a wave's assets, the
// simulator's real-world check-in point
// ============================================================
export type Channel = "x" | "xiaohongshu" | "linkedin";

export interface MeasuredChannelMetrics {
  channel: Channel;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
}

export interface MeasuredReading {
  day: number; // day index inside the wave's observation window (1-based)
  engagementRate: number; // normalized (likes+comments+shares+saves)/impressions
  metrics: MeasuredChannelMetrics;
}

export interface MeasuredAssetSummary {
  assetName: string;
  variantId: string;
  format: "still" | "motion";
  channel: Channel;
  readings: MeasuredReading[]; // sorted by day ascending
  engagementRate: number; // latest reading's engagementRate, used by decide
}

export interface MeasuredInputEntry {
  assetName: string;
  day?: number; // optional, defaults to "today" relative to plan.dates.start
  channel: Channel;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
}

export interface MeasuredInputFile {
  wave: number;
  entries: MeasuredInputEntry[];
}

// ============================================================
// Wave: the full readout for one wave, consumed by report.ts
// ============================================================
export interface WaveReadout {
  moment: string;
  waveNumber: number;
  variants: Variant[];
  briefs: Brief[];
  namedAssets: NamedAsset[];
  plan: Plan;
  produced: ProducedAsset[];
  judged: JudgeResult[];
  simulated: SimulatedCurve[];
  decided: Decision[];
  measured: MeasuredAssetSummary[]; // empty until `measure` has been run against this wave
  injectedLearnings: string | null; // learnings injected from the previous wave, if any
}
