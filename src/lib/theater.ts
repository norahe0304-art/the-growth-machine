/**
 * [INPUT]: depends on node:fs/promises to read image assets, on types.ts's WaveReadout and all its
 *   sub-types, plus optional LearningEntry[] for the closing library beat
 * [OUTPUT]: exports renderTheater(readout, libraryEntries?) -> Promise<string>, a self-contained
 *   theater.html string; also exports THEATER_CSS (the split-screen visual system) for
 *   theater-live.ts to share, so the live feed and the replay wear the same skin
 * [POS]: the showing layer of the ten-station pipeline, sibling to report.ts inside lib/. report.ts
 *   is the static record of a wave; theater.ts is a 100-130 second split-screen replay of the exact
 *   same record: THE WORK (left, a live activity log, station by station, every line a real fact
 *   pulled from WaveReadout) drives THE EVIDENCE (right, a stack of auditable cards, evidence flowing
 *   one direction only -- down, never scrolled back up to an older card to watch it change: variant
 *   cards, the nine-segment name, the threshold table, the produced stills, judge scores, a
 *   three-curve race with verdict stamps, the winning still (the cut, held static forever, no video
 *   tag ever added to it), every rollout channel chip (a video-native channel's chip carries its own
 *   hidden <video> from first render, showing only its still cover until this asset's own crossfade
 *   fires), and finally the money shot -- a brand new card appended to the bottom of the stack, only
 *   after station 8b's second approval gate has actually cleared real video-generation spend and the
 *   render itself has happened, where the hero still crossfades into its real rendered video. The
 *   still-to-video timing mirrors the real pipeline's causality on purpose: skill/SKILL.md gates
 *   video behind that second approval, so the replay never shows rendered motion -- hero or any
 *   channel chip -- before the log line that approves it. Every media-stage box (hero, money shot,
 *   channel chips, produced stills) caps at 60vh so a 9:16 render or portrait still never runs a card
 *   off the bottom of the recording viewport (scripts/record-theater.mjs's fixed 1280x800). Nothing
 *   on either side is invented. Ships alongside scripts/record-theater.mjs, which
 *   drives a real Chromium tab through it and captures the replay to mp4, and alongside
 *   theater-live.ts, the same show fed by a wave still in progress instead of a finished readout
 *   (theater-live.ts imports THEATER_CSS from here, so the 60vh media caps apply to live.html too;
 *   its own addCard() already only ever appends to the bottom, no scroll-jump bug to fix there).
 * [PROTOCOL]: update this header on change, then check CLAUDE.md
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  Decision,
  LearningEntry,
  RolloutChannelPlan,
  RolloutDraft,
  Variant,
  WaveReadout,
} from "../types.js";

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
      return {
        channel: ch.channel,
        role: ch.role,
        nativeFormat: ch.nativeFormat,
        coverURI,
        videoRelSrc,
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

    <div class="approval-gate" id="approvalGate">
      <div class="approval-gate-text">awaiting operator approval</div>
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

// ============================================================
// CSS: the portfolio design system's tokens (design.md), transplanted.
// Paper white, ink, muted, hairline. Playfair Display for the two display
// moments (wordmark, hero card title), Helvetica Neue for everything else,
// weight 300 base. Zero radius, zero shadow, 1px hairline only.
// ============================================================
export const THEATER_CSS = `
:root {
  color-scheme: light;
  --paper: #ffffff;
  --ink: #1a1a1a;
  --muted: #66686a;
  --hairline: #ececec;
  --font-display: "Playfair Display", Georgia, "Times New Roman", serif;
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

.evidence-stack { flex: 1 1 auto; overflow-y: auto; padding: 18px; display: flex; flex-direction: column; gap: 14px; scroll-behavior: smooth; }
/* Flexbox gives every child an automatic min-height of 0 the instant it has
   overflow != visible (the hero card's shimmer sweep needs overflow:hidden
   to clip). Without flex-shrink:0, once total card height exceeds the
   panel's height, the flex algorithm crushes that one card down to a
   sliver instead of leaving it at its natural content size and letting the
   panel scroll. Every card keeps its real height; the panel scrolls. */
.evidence-stack > * { flex-shrink: 0; }
.evidence-card {
  border: 1px solid var(--hairline); padding: 16px 18px; opacity: 0; transform: translateY(-14px);
  transition: opacity 0.45s ease, transform 0.45s ease, border-color 0.5s ease; cursor: default;
}
.evidence-card.in { opacity: 1; transform: translateY(0); }
.evidence-card.pulse { animation: pulseCard 1s ease; }
.evidence-card[data-evidence] { cursor: pointer; }
@keyframes pulseCard { 0% { border-color: var(--ink); } 100% { border-color: var(--hairline); } }
.evidence-title { font-family: var(--font-display); font-weight: 400; font-size: 20px; margin: 0 0 8px; }
.evidence-eyebrow { font-size: 12px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); margin-bottom: 6px; }
.evidence-caption { font-size: 12px; line-height: 1.5; color: var(--muted); }
.evidence-name { font-family: var(--font-mono); font-size: 11px; color: var(--ink); word-break: break-all; }

/* insight cards */
.variant-row { display: flex; gap: 8px; font-size: 14px; margin: 4px 0; }
.variant-row b { font-weight: 400; }
.angle-badge { display: inline-block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; border: 1px solid currentColor; padding: 2px 7px; margin-top: 8px; }

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

/* produce -- max-height caps every still to a fraction of the viewport so a
   9:16 portrait render never runs the card (media + caption) off the
   bottom of one screen; see waves/wave-04/STATE.md for the taste-gate
   screenshots that set 60vh. */
.produce-media { display: flex; align-items: center; justify-content: center; max-height: 60vh; overflow: hidden; background: #f4f3f0; }
.produce-media img { max-width: 100%; max-height: 60vh; width: auto; height: auto; object-fit: contain; display: block; filter: blur(14px); opacity: 0.35; transition: filter 1.1s ease, opacity 1.1s ease; border: 1px solid var(--hairline); }
.produce-media img.clear { filter: blur(0); opacity: 1; }
.produce-copy { font-size: 13px; font-style: italic; margin-top: 10px; min-height: 1.6em; }

/* judge */
.judge-dim { display: flex; justify-content: space-between; font-size: 12px; padding: 3px 0; border-bottom: 1px solid var(--hairline); }
.judge-pass { display: inline-block; margin-top: 8px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; border: 1px solid #4a6b4a; color: #3f5c3f; padding: 2px 7px; }
.judge-pass.fail { border-color: #8a3f3f; color: #8a3f3f; }

/* the race */
.race-card svg { display: block; width: 100%; height: 220px; }
.race-card .curve-path { fill: none; stroke-width: 2.5; }
.race-tag { font-size: 11px; font-family: var(--font-mono); }
.race-stamps { display: flex; gap: 10px; margin-top: 10px; flex-wrap: wrap; }
.race-stamp { border: 2px solid currentColor; padding: 4px 10px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0; transform: scale(0.6); transition: opacity 0.3s ease, transform 0.3s ease; }
.race-stamp.in { opacity: 1; transform: scale(1); }
.race-stamp.scale { color: #2f6b3f; box-shadow: 0 0 0 3px rgba(47,107,63,0.12); }
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
   fixed stage so the crossfade still lines up without cropping either
   one. */
.hero-media img, .hero-media video, .rollout-chip-media img, .rollout-chip-media video {
  position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain;
}
.hero-media img, .rollout-chip-media img { opacity: 1; transition: opacity 1.4s ease, transform 6s ease; }
.hero-media img.breathe, .rollout-chip-media img.breathe { transform: scale(1.04); }
.hero-media img.faded, .rollout-chip-media img.faded { opacity: 0; }
.hero-media video, .rollout-chip-media video { opacity: 0; transition: opacity 1.4s ease; }
.hero-media video.shown, .rollout-chip-media video.shown { opacity: 1; }
.hero-media .shimmer, .rollout-chip-media .shimmer {
  position: absolute; inset: 0; pointer-events: none; opacity: 0;
  background: linear-gradient(115deg, transparent 40%, rgba(255,255,255,0.55) 50%, transparent 60%);
  background-size: 220% 220%; background-position: -60% -60%;
  transition: opacity 0.3s ease;
}
.hero-media .shimmer.sweep, .rollout-chip-media .shimmer.sweep { opacity: 1; animation: sweep 0.9s ease forwards; }
@keyframes sweep { from { background-position: -60% -60%; } to { background-position: 160% 160%; } }
.hero-caption { padding-top: 12px; }

/* rollout waterfall: a video-native channel's chip carries its own hidden
   <video> from first render (see THEATER_JS) and shares the media-stage
   rules above; a still-only channel's chip is just the <img> half of the
   same box. */
.rollout-meta { padding-top: 8px; }
.rollout-channel { font-size: 13px; font-weight: 400; text-transform: capitalize; }
.rollout-role { font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
.rollout-copy { font-size: 12px; font-style: italic; margin-top: 4px; }
.rollout-kpi { font-size: 11px; color: var(--muted); margin-top: 6px; }
.cta-tag { display: inline-block; margin-top: 6px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; border: 1px solid var(--muted); padding: 2px 7px; color: var(--muted); }
.cta-tag.cta-full { border-color: var(--ink); color: var(--ink); }
.cta-tag.cta-soft { border-color: #8a7a4a; color: #8a7a4a; }

/* closing */
.closing-card .install-line { font-family: var(--font-mono); font-size: 13px; background: #f7f6f3; border: 1px solid var(--hairline); padding: 8px 10px; margin: 8px 0; }
.closing-line { font-family: var(--font-display); font-size: 17px; margin-top: 8px; }

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
  font-family: var(--font-display); font-size: 40px; letter-spacing: 0.02em; color: var(--ink);
  animation: breathe-gate 1.6s ease-in-out infinite;
}
@keyframes breathe-gate { 0%, 100% { opacity: 0.35; } 50% { opacity: 1; } }

@media (max-width: 860px) {
  .panel-work { flex-basis: 100%; }
  .panel-evidence { display: none; }
}
`;

// ============================================================
// JS engine. A single rAF-driven virtual clock replaces raw setTimeout so
// the whole replay is pausable: TIMELINE holds [time, fn] entries (the
// array-of-time/target/class shape the spec calls for, generalized to a
// callback so the handful of compound beats -- typewriter, curve self-draw,
// still-to-video crossfade -- can live beside the simple class toggles).
// Left column ("the work") is a sequential log built station by station from
// real WaveReadout fields; each line, once fully revealed, may drop one card
// into the right column ("the evidence") and pulse it. ?speed=N divides
// every delay. Space bar pauses/resumes. Clicking any [data-evidence]
// element pauses and opens a lightbox citing where that fact comes from.
// Playback stamps body[data-done="1"] on the final beat.
// ============================================================
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

  // ================= OPEN =================
  queueHeader("open", "$ growth-machine wave " + String(DATA.waveNumber).padStart(2, "0"));
  // The mission card: audience sees the brief before it sees anyone work
  // it. moment and rationale are both real fields already on the wave
  // (readout.moment, plan.rationale), nothing here is invented for effect.
  queueAction("mission: " + DATA.moment, function () {
    var c = el("article", "evidence-card");
    c.innerHTML = '<div class="evidence-eyebrow">the brief</div>' +
      '<div class="evidence-title">' + esc(DATA.moment) + '</div>' +
      '<p class="evidence-caption">' + esc(DATA.rationale) + '</p>';
    addCard(c, "readout.moment + plan.rationale");
  });
  cursor += 2500;
  if (DATA.injectedLearnings) {
    queueAction("carrying forward: " + DATA.injectedLearnings, function () {
      addCard((function () {
        var c = el("div", "evidence-card");
        c.innerHTML = '<div class="evidence-eyebrow">carried forward</div><p class="evidence-caption">' + esc(DATA.injectedLearnings) + "</p>";
        return c;
      })(), "injectedLearnings, read from library.jsonl before station 1");
    });
  }
  cursor += 400 * PACE;

  // ================= INSIGHT -> PROPOSAL (human approval gate) =================
  queueHeader("insight", "station 1 / insight");
  queueAction("reading brand/openai/brand.md");
  queueAction("reading brand/openai/history.md");
  DATA.variants.forEach(function (v, i) {
    queueAction(v.id + " formula: " + v.asset + " x " + v.newElement + " -> " + v.angleType, function () {
      var c = el("article", "evidence-card");
      c.style.color = v.angleColor;
      c.innerHTML =
        '<div class="evidence-eyebrow" style="color:' + v.angleColor + '">PROPOSAL ' + String(i + 1).padStart(2, "0") + "</div>" +
        '<div class="evidence-title">' + esc(v.workingTitle) + "</div>" +
        '<div class="variant-row"><b>' + esc(v.asset) + "</b> x <b>" + esc(v.newElement) + "</b></div>" +
        '<p class="evidence-caption">' + esc(v.angle) + "</p>" +
        '<span class="angle-badge">' + esc(v.angleType) + "</span>";
      addCard(c, "insight: " + v.angle);
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
  // This beat performs that pause instead of skipping past it.
  cursor += 400 * PACE;
  // A real 2.5s hold, deliberately NOT stretched by PACE: PACE inflates
  // content-driven pacing so the replay lands in the 100-130s band, but
  // this pause is an authored real-time beat (spec: hold 2 to 3s), not
  // content length, so it stays fixed regardless of how PACE is tuned.
  var gateHold = 2500;
  queueAction("awaiting operator approval", function () {
    runApprovalGate("awaiting operator approval", gateHold);
  });
  cursor += gateHold;
  queueAction("operator approved, production begins");
  cursor += 300 * PACE;

  function runApprovalGate(text, holdMs, onShow) {
    var gate = document.getElementById("approvalGate");
    gate.querySelector(".approval-gate-text").textContent = text;
    gate.classList.add("show");
    if (onShow) onShow();
    setTimeout(function () { gate.classList.remove("show"); }, holdMs / SPEED);
  }

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
        var c = el("article", "evidence-card");
        var segs = na.name.split("_");
        c.innerHTML = '<div class="evidence-eyebrow">nine-segment name</div><div class="name-segments" id="primarySegments"></div><div class="name-list" id="restNames"></div>';
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
    var c = el("article", "evidence-card");
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
  DATA.variants.forEach(function (v) {
    queueAction("generating " + v.stillName + " via codex exec", function () {
      var c = el("article", "evidence-card produce-card");
      var mediaHTML = v.imgURI
        ? '<div class="produce-media"><img id="img-' + v.id + '" src="' + v.imgURI + '" alt="' + esc(v.stillName) + '" /></div>'
        : '<div class="evidence-caption">no still rendered</div>';
      c.innerHTML = mediaHTML + '<div class="produce-copy" id="copy-' + v.id + '"></div>';
      addCard(c, "produced.assetPath, real codex exec image call, wave " + DATA.waveNumber);
      setTimeout(function () { var img = document.getElementById("img-" + v.id); if (img) img.classList.add("clear"); }, 250);
    });
    queueAction("copy: " + v.copy, function () {
      var target = document.getElementById("copy-" + v.id);
      if (target) typewriter(target, v.copy, 1400);
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
      var c = el("article", "evidence-card");
      var dims = j ? [["on brief", j.onBrief], ["legible", j.legible], ["shareable", j.shareable]].concat(j.brandFit != null ? [["brand fit", j.brandFit]] : []) : [];
      c.innerHTML = '<div class="evidence-eyebrow">' + esc(v.workingTitle) + "</div>" +
        dims.map(function (d) { return '<div class="judge-dim"><span>' + d[0] + "</span><span>" + d[1] + " / 3</span></div>"; }).join("") +
        '<span class="judge-pass' + (j && !j.passed ? " fail" : "") + '">' + (j && j.passed ? "PASS" : "FAIL") + "</span>";
      addCard(c, j ? j.notes : "no judge record for this asset");
    });
  });

  // ================= THE RACE (simulate + decide) =================
  queueHeader("race", "station 7 / simulate");
  DATA.variants.forEach(function (v) {
    if (v.curve) queueAction(v.id + " seed " + v.curve.seed + " -> " + DATA.planDays + "-day predicted CTR curve");
  });
  var raceCardHolder = { card: null, paths: {} };
  queueAction("drawing the response curves", function () {
    var c = el("article", "evidence-card race-card");
    var w = 640, h = 220;
    var all = [];
    DATA.variants.forEach(function (v) { if (v.curve) all = all.concat(v.curve.predictedCTR); });
    var max = Math.max.apply(null, all.concat([0.0001]));
    function toY(val) { return h - (val / max) * (h - 20) - 10; }
    var svgParts = [];
    DATA.variants.forEach(function (v) {
      if (!v.curve) return;
      var stepX = w / (v.curve.predictedCTR.length - 1);
      var pts = v.curve.predictedCTR.map(function (val, i) { return (i * stepX).toFixed(1) + "," + toY(val).toFixed(1); }).join(" ");
      svgParts.push('<polyline class="curve-path" data-vid="' + v.id + '" points="' + pts + '" stroke="' + v.angleColor + '"/>');
    });
    c.innerHTML = '<div class="evidence-eyebrow">the race, predicted CTR, ' + DATA.planDays + ' days</div>' +
      '<svg viewBox="0 0 ' + w + ' ' + h + '">' + svgParts.join("") + "</svg>" +
      '<div class="race-stamps" id="raceStamps"></div>';
    addCard(c, "simulated.predictedCTR, three deterministic response models seeded off each asset name");
    raceCardHolder.card = c;
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
      var stampsWrap = raceCardHolder.card ? raceCardHolder.card.querySelector("#raceStamps") : null;
      if (!stampsWrap) return;
      var stamp = el("div", "race-stamp " + d.verdict.toLowerCase(), esc(d.verdict) + " " + esc(v.workingTitle));
      stampsWrap.appendChild(stamp);
      requestAnimationFrame(function () { stamp.classList.add("in"); });
      if (raceCardHolder.card) {
        var path = raceCardHolder.card.querySelector('.curve-path[data-vid="' + v.id + '"]');
        if (path) {
          if (d.verdict === "KILL") path.style.opacity = "0.3";
          if (d.verdict === "SCALE") { path.style.filter = "drop-shadow(0 0 4px " + v.angleColor + ")"; path.style.strokeWidth = "4"; }
        }
      }
      var reason = el("div", "race-reason", esc(d.reason));
      stampsWrap.parentElement.appendChild(reason);
    });
  });

  // ================= THE CUT (winning still, no video yet) =================
  // Real causality: at this point in the actual pipeline no video has been
  // rendered. Station 8b's second approval gate (paid, real spend) hasn't
  // even been asked yet, let alone cleared. So this beat shows exactly what
  // exists right now -- the winning still, breathing, captioned -- and
  // nothing else. This card stays purely static for its entire life: no
  // <video> tag is ever added to it, here or later. The still-to-video
  // crossfade does not reuse this card -- see "the money shot" inside the
  // rollout beat below, a brand new card appended to the bottom of the
  // evidence stack once the render actually exists. Information flows one
  // direction only, down; nothing ever scrolls back up to an old card to
  // watch it change.
  queueHeader("cut", "the cut");
  if (DATA.hero.variantId) {
    queueAction("rollout: producing the channel cut for " + DATA.hero.variantId + " (" + DATA.hero.workingTitle + ")");
    if (DATA.hero.productionNote) queueAction("produce note: " + DATA.hero.productionNote);
    queueAction(
      "still locked: " + (DATA.hero.videoRelSrc ? "image-to-video render queued, pending station 8b approval" : "no rendered video for this wave"),
      function () {
        var c = el("article", "evidence-card hero-card");
        var mediaHTML = '<div class="hero-media">' +
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
  // Hold just long enough to read the still + its typewriter caption
  // (breathe starts at 200ms, caption typing finishes well inside this
  // window). The rest of the original 7000*PACE budget this beat used to
  // hold moves down to station 8b below, where the still-to-video
  // crossfade actually happens now -- see the note there.
  cursor += 2800 * PACE;

  // ================= ROLLOUT + LEARN =================
  // Sequence is fixed, not incidental: skill/SKILL.md station 8b ships every
  // channel cut first -- a video-native channel included, but only its
  // still cover, the same coverPath the real pipeline exports before any
  // paid render is even requested -- then stops dead for a second approval
  // gate (video generation spends real money on a paid API, stills do not)
  // before any video is submitted for render. Each video-native chip is
  // built once, right here, still-only: its own <video> tag exists in the
  // DOM from the start but stays hidden (opacity:0, no autoplay), same
  // idiom the hero card used to use. Only after the approval-gate log line
  // and the "operator approved video spend" line that follows it does that
  // SAME chip crossfade in place -- no new card, no video appearing
  // anywhere that wasn't already showing a still a moment before.
  queueHeader("rollout", "station 8b / rollout");
  var allChannels = [];
  DATA.rollouts.forEach(function (draft) {
    draft.channels.forEach(function (ch) { allChannels.push(ch); });
  });
  var videoChannels = allChannels.filter(function (ch) { return ch.nativeFormat === "video"; });
  var chipVideoRefs = {};
  var chipCounter = 0;

  function renderChannelChip(ch) {
    var c = el("article", "evidence-card");
    var isVideoChannel = ch.nativeFormat === "video" && !!ch.videoRelSrc;
    var mediaHTML = "";
    if (isVideoChannel) {
      chipCounter++;
      var chipKey = "chip" + chipCounter;
      chipVideoRefs[ch.channel + "|" + ch.videoRelSrc] = chipKey;
      mediaHTML = '<div class="rollout-chip-media">' +
        (ch.coverURI ? '<img id="' + chipKey + 'Img" src="' + ch.coverURI + '" alt="' + esc(ch.channel) + '" />' : "") +
        '<video id="' + chipKey + 'Video" muted loop playsinline src="' + esc(ch.videoRelSrc) + '"></video>' +
        '<div class="shimmer" id="' + chipKey + 'Shimmer"></div>' +
        "</div>";
    } else if (ch.coverURI) {
      mediaHTML = '<div class="rollout-chip-media"><img src="' + ch.coverURI + '" alt="' + esc(ch.channel) + '" /></div>';
    }
    var ctaTag = ch.ctaPolicy ? '<span class="cta-tag cta-' + esc(ch.ctaPolicy.level) + '">CTA ' + esc(ch.ctaPolicy.level) + '</span>' : "";
    c.innerHTML = mediaHTML + '<div class="rollout-meta"><div class="rollout-channel">' + esc(ch.channel) +
      '</div><div class="rollout-role">' + esc(ch.role) + '</div><p class="rollout-copy">' + esc(ch.channelCopy) +
      '</p><p class="rollout-kpi">' + esc(ch.kpi) + "</p>" + ctaTag + "</div>";
    addCard(c, ch.ctaPolicy ? ch.kpiThresholdNote + " / cta: " + ch.ctaPolicy.reason : ch.kpiThresholdNote);
  }

  allChannels.forEach(function (ch) {
    queueAction("shipping " + ch.channel + " cut: " + ch.kpi, function () { renderChannelChip(ch); });
  });

  if (videoChannels.length > 0) {
    var backends = videoChannels
      .map(function (ch) { return ch.productionNote; })
      .filter(Boolean)
      .join(" / ") || "backend not recorded in this readout";
    var spendHold = 2000;
    queueAction(
      videoChannels.length + " video" + (videoChannels.length > 1 ? "s" : "") + " pending real generation spend: " + backends,
      function () {
        runApprovalGate("video generation awaiting approval, real spend", spendHold);
      }
    );
    cursor += spendHold;
    queueAction("operator approved video spend", function () {
      // Crossfade each already-visible chip's own still into its own
      // video, in place. Nothing is appended, nothing is scrolled to --
      // this beat's evidence is a state change on cards the viewer has
      // already seen, not a new arrival.
      videoChannels.forEach(function (ch) {
        if (!ch.videoRelSrc) return;
        var chipKey = chipVideoRefs[ch.channel + "|" + ch.videoRelSrc];
        if (!chipKey) return;
        var img = document.getElementById(chipKey + "Img");
        var video = document.getElementById(chipKey + "Video");
        var shimmer = document.getElementById(chipKey + "Shimmer");
        if (!img || !video || !shimmer) return;
        setTimeout(function () {
          shimmer.classList.add("sweep");
          setTimeout(function () {
            video.classList.add("shown");
            img.classList.add("faded");
            video.play().catch(function () {});
          }, 500);
        }, 400);
      });
    });

    // ============= THE MONEY SHOT: a brand new card =============
    // Appended to the bottom of the evidence stack, only now -- after the
    // approval-gate log line and the render action that followed it have
    // both already printed. This is the causality skill/SKILL.md station 8b
    // describes: video generation spends real money and sits behind its own
    // approval gate, separate from the still's. The mp4 lands last, as the
    // payoff of that approval, not before it. Unlike the old version of
    // this beat, it does NOT reuse or scroll back up to the hero card built
    // in THE CUT (that card stays static forever, see the note there) --
    // it's a fresh card, so the natural downward scroll addCard() already
    // performs for every new card is all the motion this beat needs.
    // Information flows one direction: down.
    if (DATA.hero.videoRelSrc) {
      queueAction("still becomes motion: " + DATA.hero.workingTitle + " image-to-video render, the money shot", function () {
        var c = el("article", "evidence-card hero-card money-shot-card");
        c.innerHTML = '<div class="evidence-eyebrow">the money shot</div>' +
          '<div class="hero-media">' +
          (DATA.hero.imgURI ? '<img id="moneyShotImg" class="breathe" src="' + DATA.hero.imgURI + '" alt="' + esc(DATA.hero.workingTitle) + '" />' : "") +
          '<video id="moneyShotVideo" muted loop playsinline src="' + esc(DATA.hero.videoRelSrc) + '"></video>' +
          '<div class="shimmer" id="moneyShotShimmer"></div>' +
          "</div>" +
          '<div class="hero-caption"><div class="evidence-title">' + esc(DATA.hero.workingTitle) + '</div><p class="evidence-caption">' + esc(DATA.hero.copy) + "</p></div>";
        addCard(c, DATA.hero.productionNote || "the rendered money shot, image-to-video render, real generation call");
        var img = document.getElementById("moneyShotImg");
        var video = document.getElementById("moneyShotVideo");
        var shimmer = document.getElementById("moneyShotShimmer");
        if (img && video && shimmer) {
          setTimeout(function () {
            shimmer.classList.add("sweep");
            setTimeout(function () {
              video.classList.add("shown");
              img.classList.add("faded");
              video.play().catch(function () {});
            }, 500);
          }, 400);
        }
      });
      // Give the crossfade and the looping render room to actually be
      // seen before the learn station starts appending cards underneath
      // it. Paired with THE CUT's own reduced hold above, this adds back
      // up to the same 7000*PACE the money shot always got, just moved to
      // where the video itself is real now.
      cursor += 4200 * PACE;
    }
  }

  queueHeader("rollout", "station 9 / learn");
  queueAction("library.jsonl += wave " + String(DATA.libraryNewLine.wave).padStart(2, "0") + ": winners [" + (DATA.libraryNewLine.winners.join(", ") || "none") + "]", function () {
    var c = el("article", "evidence-card");
    var rows = DATA.libraryBefore.map(function (e) {
      return '<div class="rollout-role">wave ' + e.wave + ": " + (e.winners.length ? esc(e.winners.join(", ")) : "no SCALE verdicts") + "</div>";
    }).join("");
    c.innerHTML = '<div class="evidence-eyebrow">library: cross-wave winners</div>' + rows +
      '<div class="rollout-copy">wave ' + DATA.libraryNewLine.wave + ": " + (DATA.libraryNewLine.winners.join(", ") || "no SCALE verdicts") + " (just recorded)</div>";
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
