/**
 * [INPUT]: depends on node:fs/promises to read image assets, on node:child_process (execFile,
 *   promisified) to shell out to the system ffprobe for real rendered-video durations, on
 *   types.ts's WaveReadout and all its sub-types, plus optional LearningEntry[] for the closing
 *   library beat
 * [OUTPUT]: exports renderTheater(readout, libraryEntries?) -> Promise<string>, a self-contained
 *   theater.html string; also exports THEATER_CSS (the split-screen visual system) for
 *   theater-live.ts to share, so the live feed and the replay wear the same skin
 * [POS]: the showing layer of the ten-station pipeline, sibling to report.ts inside lib/. report.ts
 *   is the static record of a wave; theater.ts is a ~150 second split-screen replay of the exact
 *   same record: THE WORK (left, a live typewriter activity log, station by station, every line a
 *   real fact pulled from WaveReadout -- this column is untouched by the evidence redesign) drives
 *   THE EVIDENCE (right, a tiered, borderless stack, evidence flowing from cause to effect; rollout
 *   tiles may be refocused in place, but no video exists or plays before its approval log). The right column is organised by
 *   three tiers (公理一): Tier 1 verdicts (the input, the proposals triptych, the race, the winner,
 *   the closing bill), Tier 2 process shelves (the produce still shelf, the
 *   per-draft channel-cut shelves), Tier 3 footnotes (the nine-segment name, the threshold table,
 *   the library rows). No card borders; hierarchy is size, whitespace and alignment, hairline only
 *   inside tables and rollout media stages. The narrative is spoken by in-flow chapter headers --
 *   oversized sans lines with big air, scrolling past as part of the stream (NOT full-screen
 *   white-out overlays: the earlier approval-gate takeover language was retired on taste grounds).
 *   Both human approvals (station 1 concepts, station 8b video spend) now live only as THE WORK log
 *   lines; causality is preserved by timeline order alone -- nothing produced or rendered is queued
 *   before the log line that approved it. The three produced stills land as a shelf of thumbnails
 *   with each judge verdict stamped onto its own corner (no separate scorecards). The race draws its
 *   preregistered thresholds as dashed rules on the chart and presses each verdict stamp down at its
 *   curve's terminal point; the SCALE finalCTR counts up as a restrained workspace figure. The winning still
 *   is the cut, held static forever (no video tag ever added to it). Rollout channel cuts stand in
 *   per-draft shelves as clickable static covers before approval. Only after station 8b's approval
 *   log line clears real video generation spend are video elements attached to their own tiles.
 *   One shared tile toggle serves both manual replay and the ordered automated pass. A closing Tier-1 bill card tallies the wave's whole output
 *   (moment / bets / named assets / stills / videos / winner / seconds of video) in counted-up
 *   figures, every one derivable from readout, before the library and install hooks. Each tile video
 *   holds for its own real ffprobe'd duration (durationSec), with a real closed gap between videos,
 *   followed by a shorter gap and a still-image pass. Still-to-video timing mirrors the real
 *   pipeline's causality on purpose: skill/SKILL.md gates video behind that second approval, so the
 *   replay never creates rendered motion before the log line that approves it. Every media-stage box (hero, channel chips, produced
 *   stills) caps at 60vh so a 9:16 render or portrait still never runs a card off the bottom of the
 *   recording viewport (scripts/record-theater.mjs's fixed 1280x800). Nothing on either side is
 *   invented. Ships alongside scripts/record-theater.mjs, which drives a real Chromium tab through
 *   it and captures the replay to mp4, and alongside theater-live.ts, the same show fed by a wave
 *   still in progress instead of a finished readout (theater-live.ts imports THEATER_CSS from here,
 *   so the 60vh media caps apply to live.html too; its own addCard() already only ever appends to
 *   the bottom, no scroll-jump bug to fix there).
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import type {
  Decision,
  LearningEntry,
  RolloutChannelPlan,
  RolloutDraft,
  Variant,
  WaveReadout,
} from "../types.js";

const execFileAsync = promisify(execFile);

function escapeHTML(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function assetDataURI(assetPath: string | null): Promise<string | null> {
  if (!assetPath) return null;
  const ext = path.extname(assetPath).slice(1).toLowerCase();
  const mime = ext === "svg" ? "image/svg+xml" : ext === "png" ? "image/png" : "application/octet-stream";
  try {
    const buf = await readFile(assetPath);
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

// Real rendered-video runtime, shelled out to the system ffprobe (same
// shell-out posture scripts/record-theater.mjs already takes with ffmpeg).
// Used to size each rendered-video channel hold to the asset's
// actual duration instead of a guessed constant -- readout.json's own
// videoDurationSec field is the pre-end-card content length, not the final
// mp4's real runtime once a brand end card / transition has been appended
// (see waves/wave-04/STATE.md), so this reads the file, not the readout.
async function probeDurationSec(assetPath: string | null): Promise<number | null> {
  if (!assetPath) return null;
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      assetPath,
    ]);
    const n = parseFloat(stdout.trim());
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

const ANGLE_COLOR: Record<Variant["angleType"], string> = {
  moment: "#c2410c",
  evergreen: "#2f6b6b",
  "ugc-loop": "#6b4fa0",
};

// Ad-hoc fields (productionNote, operatorNote, brandFit) ship in the actual
// JSON several lanes ahead of the compiled src/types.ts catching up, same
// posture report.ts already takes with brandFit. Read them defensively.
function readString(obj: unknown, key: string): string | null {
  if (obj && typeof obj === "object" && key in (obj as Record<string, unknown>)) {
    const v = (obj as Record<string, unknown>)[key];
    return typeof v === "string" ? v : null;
  }
  return null;
}

// ctaPolicy is a postKit field the rollout contract now requires
// (level: none|soft|full, tiered by channel role, plus a one-sentence
// reason), landing ahead of PostKit's compiled type the same way
// brandFit landed ahead of JudgeScore's. Waves produced before this
// contract existed (wave-04 included) simply carry no ctaPolicy; render
// nothing rather than invent a tier for them.
function readCtaPolicy(postKit: unknown): { level: string; reason: string } | null {
  if (!postKit || typeof postKit !== "object" || !("ctaPolicy" in postKit)) return null;
  const cta = (postKit as Record<string, unknown>).ctaPolicy;
  if (!cta || typeof cta !== "object") return null;
  const level = (cta as Record<string, unknown>).level;
  const reason = (cta as Record<string, unknown>).reason;
  if (typeof level !== "string") return null;
  return { level, reason: typeof reason === "string" ? reason : "" };
}

// referenceSet is a skill-mode addition to brief-v{N}.json (see
// skill/SKILL.md station 2), ahead of the compiled Brief type the same way
// ctaPolicy is ahead of PostKit. Read it defensively; older waves or
// CLI-mode runs may not carry it.
function readReferenceSet(brief: unknown): { source: string; status: string; note: string } | null {
  if (!brief || typeof brief !== "object" || !("referenceSet" in brief)) return null;
  const rs = (brief as Record<string, unknown>).referenceSet;
  if (!rs || typeof rs !== "object") return null;
  const source = (rs as Record<string, unknown>).source;
  const status = (rs as Record<string, unknown>).status;
  const note = (rs as Record<string, unknown>).note;
  if (typeof source !== "string") return null;
  return { source, status: typeof status === "string" ? status : "", note: typeof note === "string" ? note : "" };
}

// ============================================================
// Client payload: every number and string the split-screen replay needs,
// pre-resolved server-side (image bytes inlined as data URIs, video paths
// made relative to theater.html's own directory).
// ============================================================
interface TheaterVariantPayload {
  id: string;
  asset: string;
  newElement: string;
  angle: string;
  workingTitle: string;
  angleType: Variant["angleType"];
  angleColor: string;
  audience: string;
  insight: string;
  stillName: string;
  motionName: string;
  copy: string;
  imgURI: string | null;
  judge: { onBrief: number; legible: number; shareable: number; brandFit: number | null; passed: boolean; notes: string } | null;
  curve: { predictedCTR: number[]; shareRate: number[]; seed: string } | null;
  decision: { verdict: Decision["verdict"]; reason: string; finalCTR: number; source: Decision["source"] } | null;
  referenceSet: { source: string; status: string; note: string } | null;
  rightsNote: string | null;
}

interface TheaterChannelPayload {
  channel: string;
  role: string;
  nativeFormat: string;
  coverURI: string | null;
  videoRelSrc: string | null;
  durationSec: number | null;
  channelCopy: string;
  kpi: string;
  kpiThresholdNote: string;
  productionNote: string | null;
  ctaPolicy: { level: string; reason: string } | null;
}

interface TheaterRolloutPayload {
  variantId: string;
  workingTitle: string;
  name: string;
  channels: TheaterChannelPayload[];
  productionNote: string | null;
  operatorNote: string | null;
}

interface TheaterHero {
  variantId: string | null;
  workingTitle: string;
  imgURI: string | null;
  videoRelSrc: string | null;
  copy: string;
  productionNote: string | null;
}

interface TheaterData {
  moment: string;
  waveNumber: number;
  injectedLearnings: string | null;
  variants: TheaterVariantPayload[];
  namedAssets: { name: string; format: string; segments: Record<string, string> }[];
  thresholds: Record<string, { scaleAt: number; killAt: number; fatigueSlope: number }>;
  planDays: number;
  rationale: string;
  rollouts: TheaterRolloutPayload[];
  hero: TheaterHero;
  libraryBefore: { wave: number; winners: string[] }[];
  libraryNewLine: { wave: number; winners: string[] };
  installCmd: string;
}

async function buildVariantPayload(readout: WaveReadout, variant: Variant): Promise<TheaterVariantPayload> {
  const brief = readout.briefs.find((b) => b.variantId === variant.id)!;
  const stillNamed = readout.namedAssets.find((n) => n.variantId === variant.id && n.format === "still");
  const motionNamed = readout.namedAssets.find((n) => n.variantId === variant.id && n.format === "motion");
  const stillProduced = readout.produced.find((p) => p.variantId === variant.id && p.format === "still");
  const stillJudge = readout.judged.find((j) => j.variantId === variant.id && j.format === "still");
  const curve = readout.simulated.find((s) => s.variantId === variant.id && s.format === "still");
  const decision = readout.decided.find((d) => d.variantId === variant.id && d.format === "still");
  const imgURI = await assetDataURI(stillProduced?.assetPath ?? null);

  return {
    id: variant.id,
    asset: variant.asset,
    newElement: variant.newElement,
    angle: variant.angle,
    workingTitle: variant.workingTitle,
    angleType: variant.angleType,
    angleColor: ANGLE_COLOR[variant.angleType],
    audience: brief.audience,
    insight: brief.insight,
    stillName: stillNamed?.name ?? "",
    motionName: motionNamed?.name ?? "",
    copy: stillProduced?.copy ?? "",
    imgURI,
    judge: stillJudge
      ? {
          onBrief: stillJudge.score.onBrief,
          legible: stillJudge.score.legible,
          shareable: stillJudge.score.shareable,
          brandFit: (stillJudge.score as unknown as { brandFit?: number }).brandFit ?? null,
          passed: stillJudge.passed,
          notes: stillJudge.notes,
        }
      : null,
    curve: curve ? { predictedCTR: curve.predictedCTR, shareRate: curve.shareRate, seed: curve.seed } : null,
    decision: decision
      ? { verdict: decision.verdict, reason: decision.reason, finalCTR: decision.finalCTR, source: decision.source }
      : null,
    referenceSet: readReferenceSet(brief),
    // rightsNote is an ad-hoc field station 1 writes onto a variant only
    // when brand.md's rights check actually declined a real-likeness
    // concept and generalized it (see skill/SKILL.md); absent on every
    // variant that never hit that check, which is the common case.
    rightsNote: readString(variant, "rightsNote"),
  };
}

async function buildRolloutPayload(waveDirRel: string, readout: WaveReadout, draft: RolloutDraft): Promise<TheaterRolloutPayload> {
  const variant = readout.variants.find((v) => v.id === draft.variantId);
  const channels = await Promise.all(
    draft.channels.map(async (ch: RolloutChannelPlan): Promise<TheaterChannelPayload> => {
      const isVideo = ch.nativeFormat === "video";
      const coverURI = isVideo ? await assetDataURI(ch.coverPath) : await assetDataURI(ch.assetPath);
      const videoRelSrc = isVideo && ch.assetPath ? path.relative(waveDirRel, ch.assetPath) : null;
      const durationSec = isVideo && ch.assetPath ? await probeDurationSec(ch.assetPath) : null;
      return {
        channel: ch.channel,
        role: ch.role,
        nativeFormat: ch.nativeFormat,
        coverURI,
        videoRelSrc,
        durationSec,
        channelCopy: ch.channelCopy,
        kpi: ch.kpi,
        kpiThresholdNote: ch.kpiThresholdNote,
        productionNote: readString(ch, "productionNote"),
        ctaPolicy: readCtaPolicy(ch.postKit),
      };
    })
  );
  return {
    variantId: draft.variantId,
    workingTitle: variant?.workingTitle ?? "",
    name: draft.name,
    channels,
    productionNote: readString(draft, "productionNote"),
    operatorNote: readString(draft, "operatorNote"),
  };
}

async function buildHero(waveDirRel: string, readout: WaveReadout): Promise<TheaterHero> {
  const scaleDecision = readout.decided.find((d) => d.verdict === "SCALE");
  if (!scaleDecision) {
    return { variantId: null, workingTitle: "", imgURI: null, videoRelSrc: null, copy: "", productionNote: null };
  }
  const variant = readout.variants.find((v) => v.id === scaleDecision.variantId);
  const stillProduced = readout.produced.find((p) => p.variantId === scaleDecision.variantId && p.format === "still");
  const imgURI = await assetDataURI(stillProduced?.assetPath ?? null);
  const draft = readout.rollouts.find((d) => d.variantId === scaleDecision.variantId);
  const videoChannel = draft?.channels.find((ch) => ch.nativeFormat === "video" && ch.assetPath);
  const videoRelSrc = videoChannel?.assetPath ? path.relative(waveDirRel, videoChannel.assetPath) : null;
  const productionNote = videoChannel ? readString(videoChannel, "productionNote") : null;
  return {
    variantId: scaleDecision.variantId,
    workingTitle: variant?.workingTitle ?? "",
    imgURI,
    videoRelSrc,
    copy: stillProduced?.copy ?? "",
    productionNote,
  };
}

export async function renderTheater(readout: WaveReadout, libraryEntries?: LearningEntry[]): Promise<string> {
  const waveDirRel = path.join("waves", `wave-${String(readout.waveNumber).padStart(2, "0")}`);

  const variants = await Promise.all(readout.variants.map((v) => buildVariantPayload(readout, v)));
  const rollouts = await Promise.all(readout.rollouts.map((d) => buildRolloutPayload(waveDirRel, readout, d)));
  const hero = await buildHero(waveDirRel, readout);

  const namedAssets = readout.namedAssets.map((n) => ({ name: n.name, format: n.format, segments: n.segments }));

  const thresholds: TheaterData["thresholds"] = {};
  for (const [angle, t] of Object.entries(readout.plan.preRegisteredThresholds)) {
    thresholds[angle] = { scaleAt: t.scaleAt, killAt: t.killAt, fatigueSlope: t.fatigueSlope };
  }

  const priorEntries = (libraryEntries ?? []).filter((e) => e.wave !== readout.waveNumber);
  const libraryBefore = priorEntries.slice(-3).map((e) => ({ wave: e.wave, winners: e.winners }));
  const thisWaveWinners = readout.decided
    .filter((d) => d.verdict === "SCALE")
    .map((d) => readout.namedAssets.find((n) => n.variantId === d.variantId && n.format === d.format)?.name ?? d.variantId);

  const data: TheaterData = {
    moment: readout.moment,
    waveNumber: readout.waveNumber,
    injectedLearnings: readout.injectedLearnings,
    variants,
    namedAssets,
    thresholds,
    planDays: readout.plan.dates.days,
    rationale: readout.plan.rationale,
    rollouts,
    hero,
    libraryBefore,
    libraryNewLine: { wave: readout.waveNumber, winners: thisWaveWinners },
    installCmd: "./install.sh",
  };

  const waveLabel = String(readout.waveNumber).padStart(2, "0");
  const dataJSON = JSON.stringify(data)
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$\{/g, "\\${")
    .replace(/<\/script/gi, "<\\/script");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>The Growth Machine, Theater &middot; wave ${escapeHTML(waveLabel)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
${THEATER_CSS}
</style>
</head>
<body>
  <div class="theater" id="theater">
    <header class="topbar">
      <span class="topbar-word">The Growth Machine</span>
      <ol class="topbar-stations" id="topbarStations">
        <li data-key="open" title="open"></li>
        <li data-key="insight" title="insight"></li>
        <li data-key="naming" title="naming"></li>
        <li data-key="plan" title="plan"></li>
        <li data-key="produce" title="produce"></li>
        <li data-key="judge" title="judge"></li>
        <li data-key="race" title="simulate + decide"></li>
        <li data-key="cut" title="the cut"></li>
        <li data-key="rollout" title="rollout + learn"></li>
      </ol>
    </header>

    <div class="workspace">
      <section class="panel panel-work">
        <div class="panel-heading">The Work</div>
        <div class="log-stream" id="logStream"></div>
      </section>
      <section class="panel panel-evidence">
        <div class="panel-heading">The Evidence</div>
        <div class="evidence-stack" id="evidenceStack"></div>
      </section>
    </div>

    <footer class="bottombar">
      <div class="bottombar-fill" id="progressFill"></div>
      <div class="bottombar-caption">replaying wave ${escapeHTML(waveLabel)}, every artifact from the actual run &middot; pause anytime, every frame is evidence</div>
    </footer>

    <div class="lightbox" id="lightbox" hidden>
      <div class="lightbox-panel">
        <div class="lightbox-media" id="lightboxMedia"></div>
        <p class="lightbox-note" id="lightboxNote"></p>
        <p class="lightbox-hint">press space or click to resume</p>
      </div>
    </div>
  </div>

<script>
window.__THEATER_DATA__ = JSON.parse(\`${dataJSON}\`);
</script>
<script>
${THEATER_JS}
</script>
</body>
</html>`;
}

export const THEATER_CSS = `
:root {
  color-scheme: light;
  --paper: #ffffff;
  --ink: #1a1a1a;
  --muted: #66686a;
  --hairline: #ececec;
  --font-sans: "Helvetica Neue", Helvetica, Inter, arial, ui-sans-serif, system-ui, sans-serif;
  --font-mono: ui-monospace, "SF Mono", Menlo, monospace;
}
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: var(--paper); color: var(--ink); }
body { font-family: var(--font-sans); font-weight: 300; line-height: 1.5; overflow: hidden; }
.theater { height: 100vh; width: 100vw; display: flex; flex-direction: column; }

.topbar {
  flex: 0 0 auto; height: 44px; display: flex; align-items: center; justify-content: space-between;
  padding: 0 20px; border-bottom: 1px solid var(--hairline);
}
.topbar-word { font-size: 12px; font-weight: 500; letter-spacing: 0.04em; text-transform: uppercase; }
.topbar-stations { display: flex; gap: 10px; list-style: none; margin: 0; padding: 0; }
.topbar-stations li { width: 7px; height: 7px; border: 1px solid var(--muted); background: transparent; }
.topbar-stations li.active { background: var(--ink); border-color: var(--ink); }
.topbar-stations li.done { background: var(--hairline); border-color: var(--muted); }

.workspace { flex: 1 1 auto; display: flex; min-height: 0; }
.panel { display: flex; flex-direction: column; min-height: 0; }
.panel-work { flex: 0 0 38%; border-right: 1px solid var(--hairline); }
.panel-evidence { flex: 1 1 62%; }
.panel-heading {
  flex: 0 0 auto; font-size: 12px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.04em;
  color: var(--muted); padding: 14px 20px 10px; border-bottom: 1px solid var(--hairline);
}

.log-stream { flex: 1 1 auto; overflow-y: auto; padding: 14px 20px 40px; scroll-behavior: smooth; }
.log-line { font-size: 13px; line-height: 1.6; color: var(--muted); margin: 1px 0; white-space: pre-wrap; word-break: break-word; }
.log-line.header { color: var(--ink); font-weight: 500; text-transform: uppercase; letter-spacing: 0.04em; font-size: 11px; margin: 14px 0 4px; }
.log-line .cursor { display: inline-block; width: 6px; height: 12px; background: var(--ink); margin-left: 2px; vertical-align: -2px; animation: blink 0.9s steps(1) infinite; }
@keyframes blink { 50% { opacity: 0; } }

.evidence-stack { flex: 1 1 auto; overflow-y: auto; padding: 16px 18px 24px; display: flex; flex-direction: column; gap: 24px; scroll-behavior: smooth; }
/* Flexbox gives every child an automatic min-height of 0 the instant it has
   overflow != visible. Without flex-shrink:0, once total card height exceeds the
   panel's height, the flex algorithm crushes that one card down to a
   sliver instead of leaving it at its natural content size and letting the
   panel scroll. Every card keeps its real height; the panel scrolls. */
.evidence-stack > * { flex-shrink: 0; }

/* ------------------------------------------------------------------
   Tiered evidence, no card chrome. 公理一: hierarchy is carried by size,
   whitespace and alignment -- not by borders. A box drawn around every
   fact is the AI-layout birthmark; it is gone. Hairline survives only
   inside a real data table and around the money-shot media stage.
   Entrance (北极星2): sink from just above and settle with a gentle
   physical overshoot -- a thing landing, not a fade materialising.
   ------------------------------------------------------------------ */
.evidence-card {
  padding: 12px; background: #fdfcf9; opacity: 0; transform: translateY(-18px);
  transition: opacity 0.5s ease, transform 0.62s cubic-bezier(0.2, 1.15, 0.32, 1);
  cursor: default;
}
.evidence-card.in { opacity: 1; transform: translateY(0); }
.evidence-card[data-evidence] { cursor: pointer; }

.tier1 { padding: 14px 12px 16px; }
/* Tier 3 -- the footnotes. Small, muted, tucked right under the beat it
   annotates: name lineage, thresholds, library rows. */
.tier3 { padding: 12px; }
.tier3 .evidence-eyebrow { margin-bottom: 4px; }

.evidence-title { font-family: var(--font-sans); font-weight: 400; font-size: 16px; margin: 0 0 7px; line-height: 1.18; }
.tier1 .evidence-title { font-size: 18px; }
.mission-card .evidence-title { font-size: 31px; line-height: 1.08; max-width: 14em; }
.evidence-eyebrow { display: flex; align-items: center; gap: 10px; font-size: 10px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.09em; color: var(--muted); margin-bottom: 10px; white-space: nowrap; }
.evidence-eyebrow::after { content: ""; flex: 1 1 auto; border-top: 1px solid var(--hairline); }
.evidence-caption { font-size: 12px; line-height: 1.42; color: var(--muted); margin: 6px 0 0; }
.evidence-name { font-family: var(--font-mono); font-size: 11px; color: var(--ink); word-break: break-all; }

/* ------------------------------------------------------------------
   Chapter header, in the flow (公理二, revised): the narrative spoken as
   an oversized sans line with big air above and below, scrolling past
   as part of the evidence stream -- no full-screen takeover, no white-out
   pause. This is how a zero-context marketer follows the story: moment in
   -> three bets -> machine grades itself -> race -> it kills its own ->
   winner ships -> library smarter. */
.chapter { padding: 18px 12px; background: var(--paper); }
.chapter-line { font-family: var(--font-sans); font-weight: 400; font-size: 18px; line-height: 1.32; color: var(--ink); max-width: 31em; margin: 0; }
.chapter-index { display: flex; align-items: center; gap: 10px; font-family: var(--font-sans); font-size: 10px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.14em; color: var(--muted); margin-bottom: 10px; }
.chapter-index::after { content: ""; flex: 1 1 auto; border-top: 1px solid var(--hairline); }

/* insight cards */
.variant-row { display: flex; gap: 8px; font-size: 13px; margin: 4px 0; }
.variant-row b { font-weight: 400; }
.angle-badge { display: inline-block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; border: 1px solid currentColor; padding: 2px 7px; margin-top: 8px; }

/* ------------------------------------------------------------------
   Triptych (公理三): three proposals side by side, one entrance each as
   its own log line types, all landing in the same row. Equal columns,
   a single hairline rule between them, no boxes. */
.triptych { display: flex; gap: 0; align-items: stretch; }
.triptych-cell { flex: 1 1 0; padding: 0 14px; opacity: 0; transform: translateY(-14px); transition: opacity 0.5s ease, transform 0.55s cubic-bezier(0.2, 1.15, 0.32, 1); }
.triptych-cell.in { opacity: 1; transform: translateY(0); }
.triptych-cell + .triptych-cell { border-left: 1px solid var(--hairline); }
.triptych-cell:first-child { padding-left: 2px; }
.triptych-cell:last-child { padding-right: 2px; }
.triptych-num { font-size: 11px; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 8px; }
.triptych-title { font-family: var(--font-sans); font-size: 16px; line-height: 1.18; margin: 0 0 8px; }
.triptych-formula { font-size: 12px; line-height: 1.45; margin-bottom: 4px; }
.triptych-formula b { font-weight: 400; }
.triptych-formula .x { color: var(--muted); padding: 0 3px; }
.triptych-angle { display: inline-block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; border: 1px solid currentColor; padding: 2px 7px; margin-top: 10px; }

/* naming */
.name-segments { font-family: var(--font-mono); font-size: 13px; line-height: 2; word-break: break-all; }
.name-segments .segment { opacity: 0; transition: opacity 0.3s ease; }
.name-segments .segment.in { opacity: 1; }
.name-list .evidence-name { display: block; margin: 3px 0; opacity: 0; transition: opacity 0.3s ease; }
.name-list .evidence-name.in { opacity: 1; }

/* plan */
.plan-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.plan-table th { text-align: left; text-transform: uppercase; letter-spacing: 0.04em; font-size: 10px; color: var(--muted); padding: 6px 8px; border-bottom: 1px solid var(--ink); }
.plan-table td { padding: 8px; border-bottom: 1px solid var(--hairline); }

/* produce (公理一 Tier 2): the three stills land on one shelf as
   thumbnails, not three stacked full cards. Each judge verdict is stamped
   straight onto its own thumbnail's corner (公理一: 不再单独成卡) instead
   of opening a separate scorecard. max-height still caps the shelf so no
   render runs the card off one screen (60vh contract, waves/wave-04/STATE.md).
   .produce-media survives for theater-live.ts, which shows one still per
   file with no shelf. */
.produce-media { display: flex; align-items: center; justify-content: center; max-height: 60vh; overflow: hidden; background: #f4f3f0; }
.produce-media img { max-width: 100%; max-height: 60vh; width: auto; height: auto; object-fit: contain; display: block; filter: blur(14px); opacity: 0.35; transition: filter 1.1s ease, opacity 1.1s ease; }
.produce-media img.clear { filter: blur(0); opacity: 1; }
.produce-copy { font-size: 13px; color: var(--muted); margin-top: 10px; min-height: 1.6em; }

.produce-shelf { display: flex; gap: 12px; align-items: flex-start; }
.produce-thumb { flex: 1 1 0; opacity: 0; transform: translateY(-14px); transition: opacity 0.5s ease, transform 0.55s cubic-bezier(0.2, 1.15, 0.32, 1); }
.produce-thumb.in { opacity: 1; transform: translateY(0); }
.produce-frame { position: relative; height: 24vh; background: #f4f3f0; overflow: hidden; display: flex; align-items: center; justify-content: center; }
.produce-frame img { max-width: 100%; max-height: 100%; object-fit: contain; display: block; filter: blur(12px); opacity: 0.4; transition: filter 1s ease, opacity 1s ease; }
.produce-frame img.clear { filter: blur(0); opacity: 1; }
.produce-thumb-copy { font-size: 11px; color: var(--muted); margin-top: 7px; line-height: 1.4; }

/* the customs stamp: the judge verdict pressed into the still's corner,
   a small deliberate rotation, slamming down to rest (北极星2). */
.judge-stamp {
  position: absolute; top: 8px; right: 8px; z-index: 2;
  font-family: var(--font-mono); font-size: 10px; font-weight: 500; letter-spacing: 0.04em;
  padding: 3px 7px; border: 1.5px solid #3f5c3f; color: #3f5c3f; background: rgba(255,255,255,0.82);
  transform: rotate(-7deg) scale(1.6); opacity: 0;
  transition: transform 0.26s cubic-bezier(0.3, 1.4, 0.4, 1), opacity 0.2s ease;
}
.judge-stamp.in { opacity: 1; transform: rotate(-7deg) scale(1); }
.judge-stamp.fail { border-color: #8a3f3f; color: #8a3f3f; }
.judge-score { font-size: 10px; color: var(--muted); margin-top: 5px; letter-spacing: 0.02em; }

/* judge -- retained for theater-live.ts, which still renders per-still
   scorecards in poll mode; the replay stamps instead. */
.judge-dim { display: flex; justify-content: space-between; font-size: 12px; padding: 3px 0; border-bottom: 1px solid var(--hairline); }
.judge-pass { display: inline-block; margin-top: 8px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; border: 1px solid #4a6b4a; color: #3f5c3f; padding: 2px 7px; }
.judge-pass.fail { border-color: #8a3f3f; color: #8a3f3f; }

/* the race (公理三, Tier 1): full-width plot. Thresholds are drawn onto
   the chart itself as faint dashed rules with a right-edge label (公理三:
   删除独立阈值卡), and each verdict stamp presses down at its own curve's
   terminal point, not in a separate list below. */
.race-plot { position: relative; width: 100%; }
.race-card svg { display: block; width: 100%; height: 240px; }
.race-card .curve-path { fill: none; stroke-width: 2.5; }
.race-card .threshold-line { stroke-width: 1; stroke-dasharray: 4 4; opacity: 0.5; }
.race-card .threshold-label { font-family: var(--font-mono); font-size: 9px; }
.curve-stamp {
  position: absolute; z-index: 3; transform: translate(-50%, -50%) rotate(-6deg) scale(1.7);
  font-family: var(--font-mono); font-size: 11px; font-weight: 500; letter-spacing: 0.05em; text-transform: uppercase;
  border: 1.5px solid currentColor; padding: 3px 8px; background: rgba(255,255,255,0.9);
  opacity: 0; transition: transform 0.28s cubic-bezier(0.3, 1.4, 0.4, 1), opacity 0.22s ease; white-space: nowrap;
}
.curve-stamp.in { opacity: 1; transform: translate(-50%, -50%) rotate(-6deg) scale(1); }
.curve-stamp.scale { color: #2f6b3f; }
.curve-stamp.kill { color: #8a3f3f; opacity: 0; }
.curve-stamp.kill.in { opacity: 0.85; }
.curve-stamp.iterate { color: #6b6b63; }

/* the winning number, counted up on the SCALE verdict (公理四: 数字主角). */
.race-verdict { margin-top: 16px; display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.race-bignum { font-family: var(--font-sans); font-size: 26px; line-height: 1; color: #2f6b3f; }
.race-bignum-note { font-size: 12px; color: var(--muted); line-height: 1.5; max-width: 20em; }
.race-bignum-note b { color: var(--ink); font-weight: 500; }

/* race-stamps / race-stamp / race-reason retained for theater-live.ts,
   which lists verdict chips in a flex row under the chart in poll mode. */
.race-stamps { display: flex; gap: 10px; margin-top: 10px; flex-wrap: wrap; }
.race-stamp { border: 2px solid currentColor; padding: 4px 10px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0; transform: scale(0.6); transition: opacity 0.3s ease, transform 0.3s ease; }
.race-stamp.in { opacity: 1; transform: scale(1); }
.race-stamp.scale { color: #2f6b3f; }
.race-stamp.kill { color: #8a3f3f; }
.race-stamp.iterate { color: #6b6b63; }
.race-reason { font-size: 11px; color: var(--muted); margin-top: 4px; }

/* the cut, the hero card + the money-shot card + every rollout channel
   chip: one shared media-stage box, height capped to a fraction of the
   viewport (not a fixed px height, so a 9:16 rollout video or portrait
   still is never taller than the screen it's recorded in -- see
   waves/wave-04/STATE.md for the taste-gate screenshots that set 60vh). */
.hero-card { position: relative; overflow: hidden; }
.hero-media, .rollout-chip-media { position: relative; width: 100%; height: 60vh; background: #f4f3f0; overflow: hidden; }
/* contain, not cover: the concept still is 16:9 and the rendered rollout
   video is often a vertical 9:16 mobile cut, a real aspect mismatch, not a
   styling choice. object-fit:contain letterboxes both inside the same
   fixed stage. */
.hero-media img, .hero-media video, .rollout-chip-media img, .rollout-chip-media video {
  position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain;
}
.hero-media img, .rollout-chip-media img { opacity: 1; transition: opacity 1.4s ease, transform 6s ease; }
.hero-media img.breathe, .rollout-chip-media img.breathe { transform: scale(1.04); }
.hero-media img.faded, .rollout-chip-media img.faded { opacity: 0; }
.hero-media video { opacity: 0; transition: opacity 1.4s ease; }
.rollout-chip-media video { opacity: 1; }
.hero-media video.shown, .rollout-chip-media video.shown { opacity: 1; }
.hero-caption { padding-top: 12px; }

.rollout-meta { padding-top: 8px; }
.rollout-channel { font-size: 13px; font-weight: 400; text-transform: capitalize; }
.rollout-role { font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
.rollout-copy { font-size: 12px; color: var(--muted); margin-top: 4px; }
.rollout-kpi { font-size: 11px; color: var(--muted); margin-top: 6px; }

.rollout-shelf { display: flex; gap: 12px; align-items: flex-start; flex-wrap: wrap; }
.rollout-cell { flex: 1 1 30%; min-width: 150px; opacity: 0; transform: translateY(-14px); transition: opacity 0.5s ease, transform 0.55s cubic-bezier(0.2, 1.15, 0.32, 1); cursor: pointer; }
.rollout-cell.in { opacity: 1; transform: translateY(0); }
.rollout-cell .rollout-chip-media { height: 22vh; background: #f4f3f0; }
.rollout-cell.is-open { flex: 1 1 100%; }
.rollout-cell.is-open .rollout-chip-media { height: 60vh; }
.rollout-cell .rollout-meta { padding-top: 7px; }
.rollout-cell .rollout-copy { font-size: 11px; line-height: 1.35; }
.rollout-cell .rollout-kpi { font-size: 10px; }

.cta-tag { display: inline-block; margin-top: 6px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; border: 1px solid var(--muted); padding: 2px 7px; color: var(--muted); }
.cta-tag.cta-full { border-color: var(--ink); color: var(--ink); }
.cta-tag.cta-soft { border-color: #8a7a4a; color: #8a7a4a; }

/* the bill (北极星2b, Tier 1): the whole wave's output, counted in real
   numbers, in the flow. This is the payoff beat -- all this work, done for
   you. Big sans figures counted up, wide air, no chrome. Every figure
   is countable from readout; nothing here is authored. */
.bill-card { padding: 16px 12px 18px; }
.bill-lead { font-family: var(--font-sans); font-size: 14px; line-height: 1.35; margin: 0 0 16px; }
.bill-grid { display: flex; flex-wrap: wrap; gap: 20px 32px; }
.bill-item { min-width: 84px; }
.bill-num { font-family: var(--font-sans); font-size: 48px; line-height: 0.9; color: var(--ink); }
.bill-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.07em; color: var(--muted); margin-top: 7px; max-width: 10em; }

/* closing */
.closing-card .install-line { font-family: var(--font-mono); font-size: 13px; background: #f7f6f3; border: 1px solid var(--hairline); padding: 8px 10px; margin: 8px 0; }
.closing-line { font-family: var(--font-sans); font-size: 15px; margin-top: 8px; }

.bottombar { flex: 0 0 auto; position: relative; border-top: 1px solid var(--hairline); padding: 9px 20px 10px; }
.bottombar-fill { position: absolute; top: -1px; left: 0; height: 1px; background: var(--ink); width: 0%; transition: width 0.4s ease; }
.bottombar-caption { font-size: 11px; color: var(--muted); letter-spacing: 0.01em; }

.lightbox { position: fixed; inset: 0; background: rgba(255,255,255,0.94); z-index: 50; display: flex; align-items: center; justify-content: center; padding: 40px; }
.lightbox[hidden] { display: none; }
.lightbox-panel { max-width: 720px; width: 100%; border: 1px solid var(--ink); background: var(--paper); padding: 24px; }
.lightbox-media { max-height: 50vh; overflow: auto; }
.lightbox-media img, .lightbox-media video { max-width: 100%; display: block; }
.lightbox-note { font-size: 13px; color: var(--muted); margin-top: 14px; border-top: 1px solid var(--hairline); padding-top: 12px; }
.lightbox-hint { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; margin-top: 10px; }
.theater.paused .evidence-card { border-color: #c9c6bb; }

/* The human approval gate: insight produces 3 proposals, then the wave
   stops dead until an operator approves or replaces them. This is a real
   pause in the pipeline (see skill/SKILL.md station 1), the full-viewport
   takeover is deliberate, not decorative -- nothing else on screen is
   allowed to compete with it while it holds. */
.approval-gate {
  position: fixed; inset: 0; background: var(--paper); z-index: 40;
  display: none; align-items: center; justify-content: center;
  opacity: 0; transition: opacity 0.4s ease;
}
.approval-gate.show { display: flex; opacity: 1; }
.approval-gate-text {
  font-family: var(--font-sans); font-size: 18px; letter-spacing: 0.02em; color: var(--ink);
  animation: breathe-gate 1.6s ease-in-out infinite;
}
@keyframes breathe-gate { 0%, 100% { opacity: 0.35; } 50% { opacity: 1; } }

@media (max-width: 860px) {
  .panel-work { flex-basis: 100%; }
  .panel-evidence { display: none; }
}
`;

const THEATER_JS = `
(function () {
  "use strict";
  var DATA = window.__THEATER_DATA__;
  var params = new URLSearchParams(location.search);
  var SPEED = Math.max(0.1, Number(params.get("speed")) || 1);

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    return n;
  }

  // ---- virtual clock: pausable, speed-scaled ----
  var PAUSED = false;
  var clockStart = performance.now();
  var pauseStart = null;
  var pausedTotal = 0;
  function elapsed() {
    var now = PAUSED ? pauseStart : performance.now();
    return (now - clockStart - pausedTotal) * SPEED;
  }
  var videosPausedByUser = [];
  function setPaused(next) {
    if (next === PAUSED) return;
    PAUSED = next;
    document.getElementById("theater").classList.toggle("paused", PAUSED);
    if (PAUSED) {
      pauseStart = performance.now();
      videosPausedByUser = [];
      document.querySelectorAll("video").forEach(function (v) { if (!v.paused) { videosPausedByUser.push(v); v.pause(); } });
    } else {
      pausedTotal += performance.now() - pauseStart;
      videosPausedByUser.forEach(function (v) { v.play().catch(function () {}); });
      videosPausedByUser = [];
    }
  }

  // ---- TIMELINE: [time, fn] pairs, fn fires once when elapsed() passes time ----
  var TIMELINE = [];
  var cursor = 0; // ms, build-time authoring cursor
  // PACE stretches every build-time gap below so the full replay (open
  // through the closing install hook) lands in the 100-130s band regardless
  // of how much real content a given wave carries. Distinct from SPEED,
  // which is a runtime ?speed=N query param a viewer or the recorder can
  // still apply on top of this.
  var PACE = 1.15;
  function at(t, fn) { TIMELINE.push([t, fn]); }
  function step(t, sel, cls) { at(t, function () { var e = document.querySelector(sel); if (e) e.classList.add(cls); }); }

  function typewriter(target, text, ms, cb) {
    var i = 0;
    var duration = ms / SPEED;
    var per = Math.max(10, duration / Math.max(1, text.length));
    target.innerHTML = '<span class="cursor"></span>';
    (function tick() {
      if (PAUSED) { setTimeout(tick, 60); return; }
      i++;
      target.innerHTML = esc(text.slice(0, i)) + '<span class="cursor"></span>';
      if (i < text.length) setTimeout(tick, per);
      else if (cb) cb();
    })();
  }

  // ---- log line + evidence card queue builder ----
  var logStream = document.getElementById("logStream");
  var evidenceStack = document.getElementById("evidenceStack");

  function queueHeader(stationKey, text) {
    at(cursor, function () { showStage(stationKey); });
    var start = cursor + 100;
    at(start, function () {
      var line = el("div", "log-line header", esc(text));
      logStream.appendChild(line);
      logStream.scrollTop = logStream.scrollHeight;
    });
    cursor = start + 500 * PACE;
  }

  function queueAction(text, evidenceFn) {
    var start = cursor;
    var dur = Math.min(1800, Math.max(500, text.length * 22)) * PACE;
    at(start, function () {
      var line = el("div", "log-line action");
      logStream.appendChild(line);
      typewriter(line, text, dur, function () {
        logStream.scrollTop = logStream.scrollHeight;
        if (evidenceFn) evidenceFn();
      });
      logStream.scrollTop = logStream.scrollHeight;
    });
    cursor = start + dur + 260 * PACE;
  }

  function addCard(card, evidenceNote) {
    if (evidenceNote) { card.setAttribute("data-evidence", "1"); card.dataset.evidenceNote = evidenceNote; }
    evidenceStack.appendChild(card);
    requestAnimationFrame(function () {
      card.classList.add("in");
      // Scroll to the new card's own top, not the stack's bottom: a card
      // taller than the remaining viewport (the hero card especially) must
      // show its top -- where the interesting content starts -- rather than
      // aligning its bottom edge flush with the panel, which would hide
      // everything above that edge. scrollIntoView lets the browser's own
      // layout pass settle this instead of a manually cached offsetTop,
      // which reads stale the instant a card containing a not-yet-decoded
      // <video> finishes laying out.
      card.scrollIntoView({ block: "start" });
      setTimeout(function () { card.classList.add("pulse"); }, 30);
    });
    return card;
  }

  // ---- in-flow chapter header: the narrative spoken as one oversized
  // sans line, big air above and below, scrolling past as part of the
  // stream (公理二 revised: no full-screen white-out). Queued on the
  // timeline so it lands between stations, then held briefly so the eye
  // reads it before the next card sinks in. ----
  function queueChapter(index, line) {
    at(cursor, function () {
      var c = el("article", "evidence-card chapter");
      c.innerHTML = '<span class="chapter-index">' + esc(index) + '</span>' +
        '<p class="chapter-line">' + esc(line) + '</p>';
      addCard(c);
    });
    cursor += 1700 * PACE;
  }

  // ---- count a number up to its target, ease-out, pause-aware (same
  // setTimeout+PAUSED posture as typewriter). fmt turns the running value
  // into its on-screen string. 数字数上去 (北极星2). ----
  function countUp(target, to, ms, fmt) {
    if (!target) return;
    var startT = null;
    var dur = ms / SPEED;
    (function tick(now) {
      if (PAUSED) { setTimeout(function () { tick(performance.now()); }, 60); return; }
      if (startT === null) startT = now;
      var p = Math.min(1, (now - startT) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      target.textContent = fmt(to * eased);
      if (p < 1) setTimeout(function () { tick(performance.now()); }, 32);
      else target.textContent = fmt(to);
    })(performance.now());
  }

  // ---- stage + progress dots ----
  var STAGE_KEYS = ["open", "insight", "naming", "plan", "produce", "judge", "race", "cut", "rollout"];
  var currentStage = null;
  function showStage(key) {
    if (currentStage === key) return;
    currentStage = key;
    var idx = STAGE_KEYS.indexOf(key);
    document.getElementById("progressFill").style.width = (((idx + 1) / STAGE_KEYS.length) * 100).toFixed(2) + "%";
    document.querySelectorAll("#topbarStations li").forEach(function (li) {
      var liIdx = STAGE_KEYS.indexOf(li.getAttribute("data-key"));
      li.classList.toggle("done", liIdx < idx);
      li.classList.toggle("active", liIdx === idx);
    });
  }

  var rolloutCells = [];
  var activeRolloutCellId = null;
  var rolloutAutoToken = 0;
  var rolloutAutoEvents = [];
  var VIDEO_GAP_MS = 1700;
  var TILE_GAP_MS = 1100;
  var TILE_HOLD_MS = 2400;

  function videoItemDurationMs(item) {
    var sec = Number(item.durationSec);
    return Number.isFinite(sec) && sec > 0 ? sec * 1000 : 8000;
  }

  function rolloutTileSequenceMs(items) {
    var videos = items.filter(function (item) { return item.nativeFormat === "video" && item.videoRelSrc; });
    var stills = items.filter(function (item) { return !(item.nativeFormat === "video" && item.videoRelSrc) && item.coverURI; });
    var videoMs = videos.reduce(function (sum, item) { return sum + videoItemDurationMs(item); }, 0) +
      Math.max(0, videos.length - 1) * VIDEO_GAP_MS;
    var phaseGapMs = videos.length > 0 && stills.length > 0 ? TILE_GAP_MS : 0;
    var stillMs = stills.length * TILE_HOLD_MS + Math.max(0, stills.length - 1) * TILE_GAP_MS;
    return videoMs + phaseGapMs + stillMs;
  }

  function closeTile(cellId) {
    var item = rolloutCells.find(function (entry) { return entry.id === cellId; });
    if (!item) return;
    item.cell.classList.remove("is-open");
    var video = item.media ? item.media.querySelector("video") : null;
    if (video) {
      video.pause();
      videosPausedByUser = videosPausedByUser.filter(function (entry) { return entry !== video; });
      try { video.currentTime = 0; } catch (e) {}
    }
    if (activeRolloutCellId === cellId) activeRolloutCellId = null;
  }

  function openTile(cellId) {
    if (activeRolloutCellId && activeRolloutCellId !== cellId) closeTile(activeRolloutCellId);
    var item = rolloutCells.find(function (entry) { return entry.id === cellId; });
    if (!item) return;
    item.cell.classList.add("is-open");
    activeRolloutCellId = cellId;
    item.cell.scrollIntoView({ block: "nearest" });
    var video = item.media ? item.media.querySelector("video") : null;
    if (video) {
      try { video.currentTime = 0; } catch (e) {}
      video.playbackRate = SPEED;
      if (PAUSED) videosPausedByUser.push(video);
      else video.play().catch(function () {});
    }
  }

  function stopRolloutTileSequence() {
    rolloutAutoToken++;
    rolloutAutoEvents = [];
  }

  function upgradeVideoTiles() {
    rolloutCells.forEach(function (item) {
      if (item.nativeFormat !== "video" || !item.videoRelSrc || !item.media || item.media.querySelector("video")) return;
      var video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.preload = "metadata";
      video.setAttribute("muted", "");
      video.setAttribute("playsinline", "");
      video.setAttribute("preload", "metadata");
      if (item.coverURI) video.poster = item.coverURI;
      video.src = item.videoRelSrc;
      video.setAttribute("data-duration-sec", String(item.durationSec || ""));
      item.media.appendChild(video);
    });
  }

  function startRolloutTileSequence() {
    stopRolloutTileSequence();
    var token = rolloutAutoToken;
    var videos = rolloutCells.filter(function (item) { return item.nativeFormat === "video" && item.videoRelSrc; });
    var stills = rolloutCells.filter(function (item) { return !(item.nativeFormat === "video" && item.videoRelSrc) && item.coverURI; });

    function later(fn, delay) {
      rolloutAutoEvents.push({ at: elapsed() + delay, token: token, fn: fn });
    }

    function runPhase(items, index, holdFor, gapMs, done) {
      if (token !== rolloutAutoToken) return;
      if (index >= items.length) {
        done();
        return;
      }
      var item = items[index];
      openTile(item.id);
      later(function () {
        closeTile(item.id);
        if (index + 1 < items.length) later(function () { runPhase(items, index + 1, holdFor, gapMs, done); }, gapMs);
        else done();
      }, holdFor(item));
    }

    runPhase(videos, 0, videoItemDurationMs, VIDEO_GAP_MS, function () {
      var runStills = function () {
        runPhase(stills, 0, function () { return TILE_HOLD_MS; }, TILE_GAP_MS, function () {});
      };
      if (videos.length > 0 && stills.length > 0) later(runStills, TILE_GAP_MS);
      else runStills();
    });
  }

  function runRolloutAutoEvents(now) {
    var due = rolloutAutoEvents.filter(function (event) { return event.at <= now; });
    if (due.length === 0) return;
    rolloutAutoEvents = rolloutAutoEvents.filter(function (event) { return event.at > now; });
    due.sort(function (a, b) { return a.at - b.at; });
    due.forEach(function (event) {
      if (event.token === rolloutAutoToken) event.fn();
    });
  }

  // ================= OPEN =================
  queueHeader("open", "$ growth-machine wave " + String(DATA.waveNumber).padStart(2, "0"));
  // The mission card: audience sees the brief before it sees anyone work
  // it. The first thing on screen is the INPUT (作战包修订二): one cultural
  // moment, in plain language, big. Not backend lineage -- a zero-context
  // marketer has to grasp "this is what went in" in one glance. The caption
  // used to echo plan.rationale verbatim ("Wave 4 splits traffic evenly...");
  // advisor called that explanation-tone copy-paste. It is now a synthesized
  // declarative sentence built from the same underlying real fields
  // (variants.length, plan.dates.days, plan.preRegisteredThresholds having
  // existed since the plan stage, before simulate/decide ever ran) --
  // nothing invented, just no longer a raw JSON-string dump.
  queueAction("mission: " + DATA.moment, function () {
    var c = el("article", "evidence-card tier1 mission-card");
    // 陈述句军规(advisor 覆盖判决): 完整主谓宾句子,禁断句蹦跳/戏剧化拟人/镜像结构。
    // 数字取自真数据(variants.length / planDays),非编造。
    var openingCaption = DATA.variants.length + " variants will run a simulated " + DATA.planDays +
      " day test. The pass and kill lines were locked before any data came in.";
    c.innerHTML = '<div class="evidence-eyebrow">the input &middot; one cultural moment goes in</div>' +
      '<div class="evidence-title">' + esc(DATA.moment) + '</div>' +
      '<p class="evidence-caption">' + esc(openingCaption) + '</p>';
    addCard(c, "readout.moment + variants.length + plan.dates.days + plan.preRegisteredThresholds");
  });
  cursor += 2500;
  // injectedLearnings is backend lineage, not door-facing. It stays in THE
  // WORK log line here (the log is untouched) and returns as a Tier-3
  // footnote at the LEARN beat -- it never gets a card competing with the
  // input at the open, and the words "carry/winner traits" leave the
  // narrative surface entirely.
  if (DATA.injectedLearnings) {
    queueAction("carrying forward: " + DATA.injectedLearnings);
  }
  cursor += 400 * PACE;

  // ================= INSIGHT -> PROPOSAL (human approval gate) =================
  queueHeader("insight", "station 1 / insight");
  queueAction("reading brand/openai/brand.md");
  queueAction("reading brand/openai/history.md");
  queueChapter("Act I", "The machine drafts " + DATA.variants.length + " creative bets from one cultural moment.");
  // The three proposals land side by side (公理三: 并列关系用并列版式), one
  // column sinking in as its own log line finishes typing, all sharing one
  // row -- workingTitle in sans, the asset x element formula, the angle
  // badge. Not three stacked bordered cards.
  var proposalRow = null;
  DATA.variants.forEach(function (v, i) {
    queueAction(v.id + " formula: " + v.asset + " x " + v.newElement + " -> " + v.angleType, function () {
      if (!proposalRow) {
        proposalRow = el("article", "evidence-card tier1 triptych");
        addCard(proposalRow, "the three proposals, insight station, one per angleType");
      }
      var cell = el("div", "triptych-cell");
      cell.innerHTML =
        '<div class="triptych-num" style="color:' + v.angleColor + '">Bet ' + String(i + 1).padStart(2, "0") + '</div>' +
        '<div class="triptych-title">' + esc(v.workingTitle) + '</div>' +
        '<p class="triptych-formula"><b>' + esc(v.asset) + '</b><span class="x">&times;</span><b>' + esc(v.newElement) + '</b></p>' +
        '<span class="triptych-angle" style="color:' + v.angleColor + '">' + esc(v.angleType) + '</span>';
      proposalRow.appendChild(cell);
      requestAnimationFrame(function () { cell.classList.add("in"); });
      proposalRow.scrollIntoView({ block: "start" });
    });
    if (v.referenceSet) {
      queueAction("consulting " + v.referenceSet.source + " (" + v.referenceSet.status + ")");
    }
    if (v.rightsNote) {
      queueAction("rights check: " + v.rightsNote);
    }
  });
  // The pipeline stops here for real: three proposals do not walk
  // themselves into production. skill/SKILL.md station 1 requires an
  // operator to approve or replace them before brief/produce ever runs.
  // The approval is real, but it lives in THE WORK log now -- the taste
  // verdict retired the full-screen white-out gate. Causality is kept by
  // timeline order alone: every produce log line and card below is queued
  // strictly after this pair, so nothing produced ever appears before the
  // approval that gated it. A short real-time hold marks the pause without
  // clearing the screen.
  cursor += 400 * PACE;
  queueAction("awaiting operator approval");
  cursor += 1500;
  queueAction("operator approved, production begins");
  cursor += 300 * PACE;

  // ================= NAMING =================
  queueHeader("naming", "station 3 / naming");
  var primaryDone = false;
  var mintedTokens = {};
  DATA.namedAssets.forEach(function (na) {
    // MOMENT is the one segment worth minting on screen: src/taxonomy.ts
    // slugs it fresh from free text every wave, and it is shared across
    // every asset in this wave, so one mint captures the whole wave's
    // token. HOOK/PERSONA are also slug-derived but repeat per variant,
    // three more beats each is pacing cost this replay cannot afford.
    ["MOMENT"].forEach(function (seg) {
      var value = na.segments && na.segments[seg];
      if (!value) return;
      var key = seg + ":" + value;
      if (mintedTokens[key]) return;
      mintedTokens[key] = true;
      queueAction("minting " + seg + " token: " + value);
    });
    queueAction("naming " + na.format + ": " + na.name, function () {
      if (!primaryDone) {
        primaryDone = true;
        var c = el("article", "evidence-card tier3");
        var segs = na.name.split("_");
        c.innerHTML = '<div class="evidence-eyebrow">nine-segment name &middot; deterministic, no LLM</div><div class="name-segments" id="primarySegments"></div><div class="name-list" id="restNames"></div>';
        addCard(c, "CHANNEL_OBJ_FUNNEL_TEMP_FORMAT_HOOK_MOMENT_PERSONA_VER, deterministic, no LLM, src/taxonomy.ts");
        var segWrap = c.querySelector("#primarySegments");
        segs.forEach(function (s, i) {
          var span = el("span", "segment", esc(s) + (i < segs.length - 1 ? "_" : ""));
          segWrap.appendChild(span);
          setTimeout(function () { span.classList.add("in"); }, i * 90);
        });
      } else {
        var restWrap = document.getElementById("restNames");
        if (restWrap) {
          var row = el("span", "evidence-name", esc(na.name));
          restWrap.appendChild(row);
          requestAnimationFrame(function () { row.classList.add("in"); });
        }
      }
    });
  });

  // ================= PLAN =================
  queueHeader("plan", "station 4 / plan");
  queueAction("observation window: " + DATA.planDays + " days");
  var angleKeys = Object.keys(DATA.thresholds);
  queueAction("thresholds locked: " + angleKeys.map(function (a) { return a + " scaleAt " + DATA.thresholds[a].scaleAt; }).join(", "), function () {
    var c = el("article", "evidence-card tier3");
    var rows = angleKeys.map(function (a) {
      var t = DATA.thresholds[a];
      return "<tr><td>" + a + "</td><td>" + (t.scaleAt * 100).toFixed(2) + "%</td><td>" + (t.killAt * 100).toFixed(2) + "%</td><td>" + t.fatigueSlope.toFixed(4) + "</td></tr>";
    }).join("");
    c.innerHTML = '<div class="evidence-eyebrow">preregistered thresholds</div><table class="plan-table"><thead><tr><th>angle</th><th>scale at</th><th>kill at</th><th>fatigue</th></tr></thead><tbody>' + rows + "</tbody></table>";
    addCard(c, "plan.json, preRegisteredThresholds, hardcoded in src/stages/plan.ts, never recomputed at decide time");
  });

  // ================= PRODUCE =================
  queueHeader("produce", "station 5 / produce");
  queueAction("economics: stills via codex exec, subscription, no per-token bill; video generation gated behind operator approval");
  queueChapter("Act II", "The machine produces each bet as a finished asset, then scores its own output.");
  // The three stills land on one shelf as thumbnails (公理一 Tier 2), each
  // sinking in on its own "generating" log line; its hook copy types under
  // it. The judge verdict is stamped onto each thumbnail's corner later
  // (see JUDGE) rather than opening a scorecard of its own.
  var produceShelf = null;
  DATA.variants.forEach(function (v) {
    queueAction("generating " + v.stillName + " via codex exec", function () {
      if (!produceShelf) {
        produceShelf = el("article", "evidence-card produce-shelf");
        addCard(produceShelf, "produced.assetPath, real codex exec image calls, wave " + DATA.waveNumber);
      }
      var thumb = el("div", "produce-thumb");
      thumb.id = "thumb-" + v.id;
      var frameHTML = v.imgURI
        ? '<div class="produce-frame"><img id="img-' + v.id + '" src="' + v.imgURI + '" alt="' + esc(v.stillName) + '" /></div>'
        : '<div class="produce-frame"><span class="evidence-caption">no still</span></div>';
      thumb.innerHTML = frameHTML + '<div class="produce-thumb-copy" id="copy-' + v.id + '"></div>';
      produceShelf.appendChild(thumb);
      requestAnimationFrame(function () { thumb.classList.add("in"); });
      produceShelf.scrollIntoView({ block: "start" });
      setTimeout(function () { var img = document.getElementById("img-" + v.id); if (img) img.classList.add("clear"); }, 250);
    });
    queueAction("copy: " + v.copy, function () {
      var target = document.getElementById("copy-" + v.id);
      if (target) typewriter(target, '"' + v.copy + '"', 1200);
    });
  });

  // ================= JUDGE =================
  queueHeader("judge", "station 6 / judge");
  DATA.variants.forEach(function (v) {
    var j = v.judge;
    var line = j
      ? v.id + " judge: onBrief " + j.onBrief + ", legible " + j.legible + ", shareable " + j.shareable + (j.brandFit != null ? ", brandFit " + j.brandFit : "") + " -> " + (j.passed ? "PASS" : "FAIL")
      : v.id + " judge: no score recorded";
    queueAction(line, function () {
      // Stamp the verdict onto this still's own thumbnail corner (公理一:
      // 不再单独成卡), a customs-stamp press-down, not a fresh scorecard.
      var frame = document.querySelector("#thumb-" + v.id + " .produce-frame");
      if (frame) {
        var stamp = el("div", "judge-stamp" + (j && !j.passed ? " fail" : ""), j ? (j.passed ? "PASS" : "FAIL") : "NO SCORE");
        frame.appendChild(stamp);
        requestAnimationFrame(function () { stamp.classList.add("in"); });
      }
      var thumb = document.getElementById("thumb-" + v.id);
      if (thumb) {
        if (j) {
          var scoreLine = el("div", "judge-score", "on-brief " + j.onBrief + " &middot; legible " + j.legible + " &middot; shareable " + j.shareable + (j.brandFit != null ? " &middot; brand " + j.brandFit : ""));
          thumb.appendChild(scoreLine);
        }
        thumb.setAttribute("data-evidence", "1");
        thumb.dataset.evidenceNote = j ? j.notes : "no judge record for this asset";
      }
    });
  });

  // ================= THE RACE (simulate + decide) =================
  queueHeader("race", "station 7 / simulate");
  DATA.variants.forEach(function (v) {
    if (v.curve) queueAction(v.id + " seed " + v.curve.seed + " -> " + DATA.planDays + "-day predicted CTR curve");
  });
  var killCount = DATA.variants.filter(function (v) { return v.decision && v.decision.verdict === "KILL"; }).length;
  queueChapter("Act III", "A " + DATA.planDays + " day simulation tests each bet against thresholds that were locked in advance, and " + (killCount > 0 ? "it kills the bets that miss them." : "it picks a winner."));
  var raceCardHolder = { card: null, plot: null, terminals: {}, vb: { w: 680, h: 260 } };
  queueAction("drawing the response curves", function () {
    var c = el("article", "evidence-card tier1 race-card");
    // Plot area sits left of a label gutter; thresholds are ruled onto the
    // chart itself (公理三: 删除独立阈值卡) and verdict stamps press down at
    // each curve's own terminal point, not in a list below.
    var vbW = 680, vbH = 260, plotW = 604, padTop = 16, padBot = 22;
    var all = [];
    DATA.variants.forEach(function (v) { if (v.curve) all = all.concat(v.curve.predictedCTR); });
    // Fold the thresholds into the y-scale so their rules sit on the same
    // axis as the curves.
    DATA.variants.forEach(function (v) {
      var t = DATA.thresholds[v.angleType];
      if (t) { all.push(t.scaleAt); all.push(t.killAt); }
    });
    var max = Math.max.apply(null, all.concat([0.0001]));
    function toY(val) { return vbH - padBot - (val / max) * (vbH - padTop - padBot); }
    var thresholdParts = [];
    var seenLevels = {};
    DATA.variants.forEach(function (v) {
      var t = DATA.thresholds[v.angleType];
      if (!t) return;
      [["scale", t.scaleAt], ["kill", t.killAt]].forEach(function (lv) {
        var key = lv[0] + ":" + lv[1].toFixed(4);
        if (seenLevels[key]) return;
        seenLevels[key] = true;
        var y = toY(lv[1]).toFixed(1);
        thresholdParts.push('<line class="threshold-line" x1="0" y1="' + y + '" x2="' + plotW + '" y2="' + y + '" stroke="' + v.angleColor + '"/>' +
          '<text class="threshold-label" x="' + (plotW + 6) + '" y="' + (Number(y) + 3).toFixed(1) + '" fill="' + v.angleColor + '">' + lv[0] + " " + (lv[1] * 100).toFixed(1) + '%</text>');
      });
    });
    var svgParts = [];
    DATA.variants.forEach(function (v) {
      if (!v.curve) return;
      var stepX = plotW / (v.curve.predictedCTR.length - 1);
      var pts = v.curve.predictedCTR.map(function (val, i) { return (i * stepX).toFixed(1) + "," + toY(val).toFixed(1); }).join(" ");
      svgParts.push('<polyline class="curve-path" data-vid="' + v.id + '" points="' + pts + '" stroke="' + v.angleColor + '"/>');
      var last = v.curve.predictedCTR[v.curve.predictedCTR.length - 1];
      raceCardHolder.terminals[v.id] = { leftPct: (plotW / vbW) * 100, topPct: (toY(last) / vbH) * 100 };
    });
    c.innerHTML = '<div class="evidence-eyebrow">the race &middot; predicted CTR over ' + DATA.planDays + ' days</div>' +
      '<div class="race-plot" id="racePlot"><svg viewBox="0 0 ' + vbW + ' ' + vbH + '">' + thresholdParts.join("") + svgParts.join("") + "</svg></div>";
    addCard(c, "simulated.predictedCTR, three deterministic response models seeded off each asset name; thresholds from plan.json");
    raceCardHolder.card = c;
    raceCardHolder.plot = c.querySelector("#racePlot");
    c.querySelectorAll(".curve-path").forEach(function (p) {
      var len = p.getTotalLength ? p.getTotalLength() : 800;
      p.style.strokeDasharray = len;
      p.style.strokeDashoffset = len;
      p.style.transition = "stroke-dashoffset " + (2400 / SPEED) + "ms ease";
      requestAnimationFrame(function () { requestAnimationFrame(function () { p.style.strokeDashoffset = "0"; }); });
    });
  });
  cursor += 2600 * PACE;
  queueHeader("race", "station 8 / decide");
  DATA.variants.forEach(function (v) {
    var d = v.decision;
    if (!d) return;
    queueAction(v.id + " " + d.verdict + ": " + d.reason, function () {
      if (!raceCardHolder.plot) return;
      // Press the verdict stamp down at this curve's terminal point.
      var term = raceCardHolder.terminals[v.id];
      if (term) {
        var stamp = el("div", "curve-stamp " + d.verdict.toLowerCase(), esc(d.verdict));
        stamp.style.left = term.leftPct.toFixed(2) + "%";
        stamp.style.top = term.topPct.toFixed(2) + "%";
        raceCardHolder.plot.appendChild(stamp);
        requestAnimationFrame(function () { stamp.classList.add("in"); });
      }
      var path = raceCardHolder.card.querySelector('.curve-path[data-vid="' + v.id + '"]');
      if (path) {
        if (d.verdict === "KILL") path.style.opacity = "0.28";
        if (d.verdict === "SCALE") { path.style.filter = "drop-shadow(0 0 3px " + v.angleColor + ")"; path.style.strokeWidth = "4"; }
      }
      // The winning number, counted up (公理四: 数字主角、文案宣判).
      if (d.verdict === "SCALE") {
        var vwrap = el("div", "race-verdict");
        vwrap.innerHTML = '<span class="race-bignum" id="raceBignum">0.00%</span>' +
          '<span class="race-bignum-note"><b>' + esc(v.workingTitle) + '</b> scaled. Last-3-day CTR cleared the preregistered scale line.</span>';
        raceCardHolder.card.appendChild(vwrap);
        countUp(document.getElementById("raceBignum"), d.finalCTR * 100, 1100, function (x) { return x.toFixed(2) + "%"; });
      }
    });
  });

  // ================= THE CUT (winning still, no video yet) =================
  queueHeader("cut", "the cut");
  if (DATA.hero.variantId) {
    queueAction("rollout: producing the channel cut for " + DATA.hero.variantId + " (" + DATA.hero.workingTitle + ")");
    if (DATA.hero.productionNote) queueAction("produce note: " + DATA.hero.productionNote);
    queueAction(
      "still locked: " + (DATA.hero.videoRelSrc ? "image-to-video render queued, pending station 8b approval" : "no rendered video for this wave"),
      function () {
        var c = el("article", "evidence-card tier1 hero-card");
        var mediaHTML = '<div class="evidence-eyebrow">the winner &middot; the cut, held as a still</div><div class="hero-media">' +
          (DATA.hero.imgURI ? '<img id="heroImg" src="' + DATA.hero.imgURI + '" alt="' + esc(DATA.hero.workingTitle) + '" />' : "") +
          "</div>" +
          '<div class="hero-caption"><div class="evidence-title">' + esc(DATA.hero.workingTitle) + '</div><p class="evidence-caption" id="heroCopy"></p></div>';
        c.innerHTML = mediaHTML;
        addCard(c, DATA.hero.productionNote || "the winning still, produced.assetPath, real generation call");
        var img = document.getElementById("heroImg");
        if (img) setTimeout(function () { img.classList.add("breathe"); }, 200);
        setTimeout(function () {
          var copyEl = document.getElementById("heroCopy");
          if (copyEl) typewriter(copyEl, DATA.hero.copy, 1600);
        }, 700);
      }
    );
  } else {
    queueAction("no SCALE verdict this wave, nothing rolled out", function () {
      var c = el("article", "evidence-card");
      c.innerHTML = '<div class="evidence-eyebrow">the cut</div><p class="evidence-caption">no still cleared the preregistered threshold this wave.</p>';
      addCard(c, "decided[], no verdict === SCALE");
    });
  }
  cursor += 2800 * PACE;

  // ================= ROLLOUT + LEARN =================
  queueHeader("rollout", "station 8b / rollout");
  queueChapter("Act IV", "The winner ships to every channel in that channel's native format.");
  var allChannels = [];
  DATA.rollouts.forEach(function (draft) {
    draft.channels.forEach(function (ch) { allChannels.push(ch); });
  });
  var videoChannels = allChannels.filter(function (ch) { return ch.nativeFormat === "video"; });
  var draftShelves = {};
  function renderChannelCell(draft, di, ch, channelIndex) {
    var holder = draftShelves[di];
    if (!holder) {
      var card = el("article", "evidence-card");
      var noteHTML = draft.operatorNote ? '<p class="evidence-caption" style="margin-top:5px">' + esc(draft.operatorNote) + '</p>' : "";
      card.innerHTML = '<div class="evidence-eyebrow">the channel cuts &middot; ' + esc(draft.workingTitle) + '</div>' + noteHTML + '<div class="rollout-shelf"></div>';
      addCard(card, draft.operatorNote || ("rollout draft for " + draft.workingTitle + ", every channel cut re-expressed native to its surface"));
      holder = { card: card, shelf: card.querySelector(".rollout-shelf") };
      draftShelves[di] = holder;
    }
    var cellId = "rolloutCell-" + di + "-" + channelIndex;
    var cell = el("div", "rollout-cell");
    cell.id = cellId;
    cell.setAttribute("data-draft-index", String(di));
    var mediaHTML = "";
    if (ch.coverURI || ch.videoRelSrc) {
      mediaHTML = '<div class="rollout-chip-media">' +
        (ch.coverURI ? '<img src="' + ch.coverURI + '" alt="' + esc(ch.channel) + '" />' : "") +
        "</div>";
    }
    var ctaTag = ch.ctaPolicy ? '<span class="cta-tag cta-' + esc(ch.ctaPolicy.level) + '">CTA ' + esc(ch.ctaPolicy.level) + '</span>' : "";
    cell.innerHTML = mediaHTML + '<div class="rollout-meta"><div class="rollout-channel">' + esc(ch.channel) +
      '</div><div class="rollout-role">' + esc(ch.role) + '</div><p class="rollout-copy">&quot;' + esc(ch.channelCopy) + '&quot;</p>' + ctaTag + "</div>";
    cell.setAttribute("data-evidence", "1");
    cell.dataset.evidenceNote = ch.ctaPolicy ? ch.kpiThresholdNote + " / cta: " + ch.ctaPolicy.reason : ch.kpiThresholdNote;
    holder.shelf.appendChild(cell);
    rolloutCells.push({
      id: cellId,
      cell: cell,
      media: cell.querySelector(".rollout-chip-media"),
      nativeFormat: ch.nativeFormat,
      coverURI: ch.coverURI,
      videoRelSrc: ch.videoRelSrc,
      durationSec: ch.durationSec
    });
    cell.addEventListener("click", function (event) {
      event.stopPropagation();
      stopRolloutTileSequence();
      if (cell.classList.contains("is-open")) closeTile(cellId);
      else openTile(cellId);
    });
    requestAnimationFrame(function () { cell.classList.add("in"); });
    holder.card.scrollIntoView({ block: "start" });
  }

  DATA.rollouts.forEach(function (draft, di) {
    draft.channels.forEach(function (ch, channelIndex) {
      queueAction("shipping " + ch.channel + " cut: " + ch.kpi, function () { renderChannelCell(draft, di, ch, channelIndex); });
    });
  });

  if (videoChannels.length > 0) {
    var backends = videoChannels
      .map(function (ch) { return ch.productionNote; })
      .filter(Boolean)
      .join(" / ") || "backend not recorded in this readout";
    var spendHold = 2000;
    queueAction(
      videoChannels.length + " video" + (videoChannels.length > 1 ? "s" : "") + " pending real generation spend: " + backends
    );
    cursor += spendHold;
    queueAction("operator approved video spend", function () {
      upgradeVideoTiles();
      startRolloutTileSequence();
    });
    cursor += rolloutTileSequenceMs(allChannels);
  }

  // ============= THE BILL: the whole wave's output, counted (北极星2b) =============
  // A Tier-1 in-flow tally, the payoff beat -- all this work, done for you.
  // Every figure is countable from readout; nothing is authored. No
  // left-column log line: the log is the machine's and stays untouched, the
  // bill is pure evidence-column narration dropped straight on the timeline.
  at(cursor, function () {
    var stillsCount = DATA.variants.filter(function (v) { return v.imgURI; }).length;
    var renderedVideos = [];
    DATA.rollouts.forEach(function (draft) {
      draft.channels.forEach(function (ch) {
        if (ch.nativeFormat === "video" && ch.videoRelSrc) renderedVideos.push(ch);
      });
    });
    var videosCount = renderedVideos.length;
    var winnersCount = DATA.variants.filter(function (v) { return v.decision && v.decision.verdict === "SCALE"; }).length;
    var videoSeconds = Math.round(renderedVideos.reduce(function (a, ch) { return a + (ch.durationSec || 0); }, 0));
    var items = [
      { to: 1, label: "cultural moment in" },
      { to: DATA.variants.length, label: "bets placed" },
      { to: DATA.namedAssets.length, label: "assets named" },
      { to: stillsCount, label: "stills made" },
      { to: videosCount, label: "videos rendered" },
      { to: winnersCount, label: "scaled to rollout" },
      { to: videoSeconds, label: "seconds of finished video" }
    ];
    var c = el("article", "evidence-card tier1 bill-card");
    c.innerHTML = '<div class="evidence-eyebrow">the bill</div>' +
      '<p class="bill-lead">Everything the machine produced from one moment.</p>' +
      '<div class="bill-grid">' + items.map(function (it, i) {
        return '<div class="bill-item"><div class="bill-num" id="bill' + i + '">0</div><div class="bill-label">' + esc(it.label) + "</div></div>";
      }).join("") + "</div>";
    addCard(c, "every figure counted from readout.json: variants, namedAssets, produced stills, rendered videos, SCALE verdicts, ffprobe durations");
    items.forEach(function (it, i) {
      countUp(document.getElementById("bill" + i), it.to, 900 + i * 120, function (x) { return String(Math.round(x)); });
    });
  });
  cursor += 3800 * PACE;

  queueHeader("rollout", "station 9 / learn");
  queueChapter("Act V", "The library keeps what won and hands it to the next wave.");
  queueAction("library.jsonl += wave " + String(DATA.libraryNewLine.wave).padStart(2, "0") + ": winners [" + (DATA.libraryNewLine.winners.join(", ") || "none") + "]", function () {
    var c = el("article", "evidence-card tier3");
    var rows = DATA.libraryBefore.map(function (e) {
      return '<div class="rollout-role">wave ' + e.wave + ": " + (e.winners.length ? esc(e.winners.join(", ")) : "no SCALE verdicts") + "</div>";
    }).join("");
    // injectedLearnings returns here as a footnote (作战包修订二): the trait
    // this wave carried forward, shown at the beat that WRITES the next one,
    // not at the open.
    var carried = DATA.injectedLearnings
      ? '<p class="evidence-caption" style="margin-top:8px">carried into this wave: ' + esc(DATA.injectedLearnings) + "</p>"
      : "";
    c.innerHTML = '<div class="evidence-eyebrow">library &middot; cross-wave winners</div>' + rows +
      '<div class="rollout-copy">wave ' + DATA.libraryNewLine.wave + ": " + (DATA.libraryNewLine.winners.join(", ") || "no SCALE verdicts") + " (just recorded)</div>" + carried;
    addCard(c, "library.jsonl, appended by station 9, injected into wave " + (DATA.waveNumber + 1) + "'s insight prompt");
  });

  queueAction("$ " + DATA.installCmd, function () {
    var c = el("article", "evidence-card closing-card");
    c.innerHTML = '<div class="evidence-eyebrow">install your own</div>' +
      '<div class="install-line">$ ' + esc(DATA.installCmd) + "</div>" +
      '<p class="closing-line" id="closingLine"></p>';
    addCard(c);
    var closingLine = document.getElementById("closingLine");
    var sentence = "Wave " + String(DATA.waveNumber).padStart(2, "0") + " is complete. The library is smarter than it was two minutes ago. This replay was made by the machine it shows. Install it and run your own wave.";
    typewriter(closingLine, sentence, 3600);
  });
  cursor += 4200 * PACE;

  var finalT = cursor;
  at(finalT, function () { document.body.setAttribute("data-done", "1"); });

  TIMELINE.sort(function (a, b) { return a[0] - b[0]; });
  var fired = 0;
  function loop() {
    var e = elapsed();
    while (fired < TIMELINE.length && TIMELINE[fired][0] <= e) { TIMELINE[fired][1](); fired++; }
    runRolloutAutoEvents(e);
    if (fired < TIMELINE.length || true) requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // ---- lightbox: click any evidence card, space to pause/resume ----
  var lightbox = document.getElementById("lightbox");
  var lightboxMedia = document.getElementById("lightboxMedia");
  var lightboxNote = document.getElementById("lightboxNote");
  function openLightbox(target) {
    if (!PAUSED) setPaused(true);
    lightboxMedia.innerHTML = "";
    var clone = target.cloneNode(true);
    clone.removeAttribute("data-evidence");
    lightboxMedia.appendChild(clone);
    lightboxNote.textContent = target.dataset.evidenceNote || "";
    lightbox.hidden = false;
  }
  function closeLightbox() {
    lightbox.hidden = true;
    if (PAUSED) setPaused(false);
  }
  document.addEventListener("click", function (e) {
    if (!lightbox.hidden) {
      if (e.target === lightbox) closeLightbox();
      return;
    }
    var target = e.target.closest("[data-evidence]");
    if (target) openLightbox(target);
  });
  document.addEventListener("keydown", function (e) {
    if (e.code === "Space") {
      e.preventDefault();
      if (!lightbox.hidden) closeLightbox();
      else setPaused(!PAUSED);
    } else if (e.code === "Escape" && !lightbox.hidden) {
      closeLightbox();
    }
  });
})();
`;
