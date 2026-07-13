/**
 * [INPUT]: no dependencies, pure type definitions
 * [OUTPUT]: exports the shared types that run through the ten-station pipeline —— Variant / Brief / NamedAsset / Plan / ProducedAsset / JudgeResult / SimulatedCurve / Decision / RolloutDraft / LearningEntry / measure-module types
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

// ReferenceEntry: one pulled-in source card entry backing a brief's
// generationPrompts, skill-mode and Codex-CLI-mode station 2 reads
// references/<channel>.md (or references/cross-channel.md) before writing
// the prompt and names what it pulled here. status is "live" when a real
// pull succeeded, "starter-unverified" when it fell back to that file's
// starter rules section. Was skill-mode-only, written directly into
// brief-v{N}.json; now a first-class optional field on the compiled Brief
// so CLI-mode readers (report.ts, rollout-validate, etc.) share one shape.
export interface ReferenceEntry {
  source: string; // the references/*.md file consulted
  entry: string; // the specific card entry or starter rule pulled
  status: "live" | "starter-unverified";
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
  referenceSet?: ReferenceEntry[]; // optional: CLI-mode briefs never set this, older waves predate it entirely
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
// Judge: three-point self-check, plus an optional fourth brand-fit
// dimension. brandFit was a skill-mode and Codex-CLI-mode addition scored
// against brand/<pack>/brand.md's restraint/register/rights checks (default
// 2 when no brand pack is configured); now wired into the CLI judge station
// too (see stages/judge.ts), so it is optional here rather than required —
// readout.json written before this field existed still deserializes cleanly.
// ============================================================
export interface JudgeScore {
  onBrief: 1 | 2 | 3;
  legible: 1 | 2 | 3;
  shareable: 1 | 2 | 3;
  brandFit?: 1 | 2 | 3;
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
// Rollout: station 8b, runs only for SCALE verdicts. Turns a judgment call
// into a channel-by-channel playbook: which channels, what role each one
// plays, what the asset spec changes per channel, what to actually do, and
// which KPI ties that channel back to the plan's preregistered thresholds.
// ============================================================
export type RolloutRole = "discovery" | "amplification" | "retention" | "conversion";

// Format follows the channel: a channel cut is delivered in the format the
// channel natively speaks, not a resized copy of the concept still.
//   video      -> the deliverable is a ChatCut-ready three-shot script plus a
//                 cover frame image (assetPath holds the cover frame)
//   ugc-still  -> a creator-aesthetic phone-shot still, candid, unretouched
//   still      -> a native editorial still, hook line carried in frame
//   surface    -> a crop tuned for an in-product surface (e.g. circular mask)
export type RolloutNativeFormat = "video" | "ugc-still" | "still" | "surface";

// ============================================================
// PostKit: what actually ships on one channel. Every RolloutChannelPlan
// carries one — the file that gets posted plus the caption / hashtags /
// altText / posting instructions a human (or an automation) needs to
// actually publish it, not just a rendered asset and a hope. Introduced
// when "video channel" stopped meaning "a cover frame and a script" and
// started meaning "a real video file that ships."
// ============================================================
export interface PostKit {
  file: string; // the file that actually gets posted: mp4 path for a video channel, image path for every other nativeFormat
  caption: string; // 2 to 3 sentences, written in the channel's native voice
  hashtags: string[]; // 3 to 6 tags, no filler
  altText: string; // accessibility description of what is on screen
  postingNote: string; // when to post, who to tag, what to pin — the human operating note
}

// ============================================================
// ParticipationKit: what a ugc-loop concept gets instead of a faked "UGC"
// image. An AI-generated still can still illustrate the mechanic (labeled
// illustrative, never presented as real user content), but the real
// deliverable is the mechanic itself: what real users are asked to do,
// shoot, caption, and credit. One kit per RolloutDraft whose variant's
// angleType is "ugc-loop"; null for every other angleType.
// ============================================================
export interface ParticipationKit {
  mechanic: string; // one sentence: what a real user actually does to participate
  creatorShotList: string[]; // 3 to 4 entries, real-phone shot instructions for a real creator
  seedCaptions: string[]; // 3 entries, ready-to-use captions handed to real users
  creditRule: string; // one sentence: how credit passes from one participant to the next
}

export interface RolloutChannelPlan {
  channel: string; // e.g. tiktok, instagram, x, in-app profile surface
  role: RolloutRole;
  nativeFormat: RolloutNativeFormat; // the channel's native delivery format, derived from the channel, never model-chosen
  // assetName/assetPath/channelCopy/channelScript are the channel cut: this
  // channel's own expansion arm off the winning concept, not the concept
  // asset itself. Every channel cut earns its own SCALE/KILL verdict against
  // its own kpi below, the concept-level WEB name only ever proved the idea.
  assetName: string; // nine-segment name, CHANNEL segment swapped to this channel's token via taxonomy.deriveChannelAssetName, the other eight segments inherited from the winning still's NamedAsset.name
  // For a video channel: the rendered mp4 path once real image-to-video
  // generation plus ffmpeg assembly has produced one, null while pending.
  // For every other nativeFormat: the still image path (png when a real
  // image call produced one, svg when mock mode placeholdered it), null
  // when generation was unavailable or failed.
  assetPath: string | null;
  coverPath: string | null; // video channels only: the no-text cover frame still (drawtext happens in the ffmpeg assembly step, never baked into the generated cover); null for every other nativeFormat
  videoDurationSec: number | null; // video channels only, set once assetPath holds a real rendered mp4; null otherwise
  illustrativeLabel: string | null; // set when the still stands in for real user content that does not exist yet (e.g. a ugc-still channel cut on a ugc-loop concept), reading "template preview, illustrative"; null when the image is not standing in for real UGC
  channelCopy: string; // one line of finished, channel-voiced ad copy, ready to ship as-is
  channelScript: string[] | null; // video channels only: a ChatCut-ready three-shot script whose shot 3 lands the channelCopy; null for every other nativeFormat
  assetSpec: string; // one sentence: format, ratio, how the hook adapts for this channel
  executionSteps: string[]; // 3 to 4 action sentences
  kpi: string; // one concrete number tied to an outcome
  kpiThresholdNote: string; // one sentence linking kpi back to the plan's preregistered threshold system
  postKit: PostKit; // the actual publish-ready deliverable for this channel
}

export interface RolloutDraft {
  variantId: string;
  name: string; // the still NamedAsset.name this rollout targets
  channels: RolloutChannelPlan[]; // 3 to 4 entries
  participationKit: ParticipationKit | null; // set when this draft's concept angleType is ugc-loop; null otherwise
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
  rollouts: RolloutDraft[]; // one per SCALE verdict; empty when no still asset has scaled yet
  injectedLearnings: string | null; // learnings injected from the previous wave, if any
}
