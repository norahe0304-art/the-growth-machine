/**
 * [INPUT]: depends on node:fs/promises to read image assets, on types.ts's WaveReadout and all its sub-types, plus optional LearningEntry[] for the library summary block
 * [OUTPUT]: exports renderReport(readout, libraryEntries?) -> Promise<string>, a self-contained report.html string
 * [POS]: the terminal presentation layer of the nine-station pipeline, outside stages/ (it doesn't participate in decisions) — paints a WaveReadout into an editorial layout, with a predicted-vs-measured overlay once measure.ts has run
 * [PROTOCOL]: update this header on change, then check CLAUDE.md
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  Brief,
  Decision,
  JudgeResult,
  LearningEntry,
  MeasuredAssetSummary,
  NamedAsset,
  ProducedAsset,
  SimulatedCurve,
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
  const buf = await readFile(assetPath);
  return `data:${mime};base64,${buf.toString("base64")}`;
}

// A day-level line chart, inline SVG, pure function, no external deps.
// predicted always renders as a dashed line. When measured points are
// supplied they render as a solid line connecting the actual check-ins
// (a lone point still renders as a dot) — dashed vs solid IS the legend.
function curveSVG(params: {
  predicted: number[];
  measured?: { day: number; value: number }[];
  color: string;
  measuredColor?: string;
  width?: number;
  height?: number;
}): string {
  const { predicted, measured, color, measuredColor = "#c2410c", width = 560, height = 140 } = params;
  const measuredValues = measured?.map((m) => m.value) ?? [];
  const max = Math.max(...predicted, ...measuredValues, 0.0001);
  const min = 0;
  const stepX = width / (predicted.length - 1);
  const toY = (v: number) => height - ((v - min) / (max - min)) * (height - 20) - 10;

  const predictedPoints = predicted.map((v, i) => `${(i * stepX).toFixed(1)},${toY(v).toFixed(1)}`).join(" ");
  const gridLines = [0.25, 0.5, 0.75]
    .map((f) => `<line x1="0" y1="${height * f}" x2="${width}" y2="${height * f}" stroke="#e8e5dd" stroke-width="1"/>`)
    .join("");

  let measuredMarkup = "";
  if (measured && measured.length > 0) {
    const sorted = [...measured].sort((a, b) => a.day - b.day);
    const pts = sorted.map((m) => `${((m.day - 1) * stepX).toFixed(1)},${toY(m.value).toFixed(1)}`);
    const line = pts.length >= 2 ? `<polyline points="${pts.join(" ")}" fill="none" stroke="${measuredColor}" stroke-width="2.5"/>` : "";
    const dots = sorted
      .map((m) => `<circle cx="${((m.day - 1) * stepX).toFixed(1)}" cy="${toY(m.value).toFixed(1)}" r="3.5" fill="${measuredColor}"><title>day ${m.day}: ${(m.value * 100).toFixed(2)}%</title></circle>`)
      .join("");
    measuredMarkup = `${line}${dots}`;
  }

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" preserveAspectRatio="none">
    ${gridLines}
    <polyline points="${predictedPoints}" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="4 4"/>
    ${measuredMarkup}
  </svg>`;
}

function curveLegend(hasMeasured: boolean, color: string, measuredColor = "#c2410c"): string {
  if (!hasMeasured) return "";
  return `<div class="curve-legend">
    <span class="legend-item"><span class="legend-swatch legend-dashed" style="border-color:${color}"></span>predicted</span>
    <span class="legend-item"><span class="legend-swatch legend-solid" style="background:${measuredColor}"></span>measured</span>
  </div>`;
}

function verdictBadge(verdict: Decision["verdict"]): string {
  const cls = verdict === "SCALE" ? "badge-scale" : verdict === "KILL" ? "badge-kill" : "badge-iterate";
  return `<span class="badge ${cls}">${verdict}</span>`;
}

function sourceBadge(source: Decision["source"] | undefined): string {
  if (!source) return "";
  const cls = source === "measured" ? "badge-measured" : "badge-simulated";
  return `<span class="badge ${cls}">${source}</span>`;
}

function judgeBadge(judge: JudgeResult | undefined): string {
  if (!judge) return "";
  const cls = judge.passed ? "badge-pass" : "badge-fail";
  const label = judge.passed ? "PASS" : "FAIL";
  const regen = judge.regenerated ? " (regenerated)" : "";
  return `<span class="badge ${cls}">judge ${label}${regen}</span>`;
}

async function renderVariantCard(params: {
  variant: Variant;
  brief: Brief;
  stillNamed: NamedAsset | undefined;
  motionNamed: NamedAsset | undefined;
  stillProduced: ProducedAsset | undefined;
  motionProduced: ProducedAsset | undefined;
  stillJudge: JudgeResult | undefined;
  motionJudge: JudgeResult | undefined;
  stillCurve: SimulatedCurve | undefined;
  stillDecision: Decision | undefined;
  stillMeasured: MeasuredAssetSummary | undefined;
}): Promise<string> {
  const {
    variant,
    brief,
    stillNamed,
    motionNamed,
    stillProduced,
    stillJudge,
    motionJudge,
    stillCurve,
    stillDecision,
    stillMeasured,
  } = params;

  const imgURI = await assetDataURI(stillProduced?.assetPath ?? null);
  const measuredPoints = stillMeasured?.readings.map((r) => ({ day: r.day, value: r.engagementRate }));
  const hasMeasured = Boolean(measuredPoints && measuredPoints.length > 0);
  const ctrCurve = stillCurve
    ? curveSVG({ predicted: stillCurve.predictedCTR, measured: measuredPoints, color: "#1a1a1a" })
    : "";
  const shareCurve = stillCurve ? curveSVG({ predicted: stillCurve.shareRate, color: "#a8a59c" }) : "";

  return `
  <article class="variant-card">
    <header class="variant-head">
      <div class="atom-line">
        <span class="atom-label">Asset</span>
        <span class="atom-value">${escapeHTML(variant.asset)}</span>
        <span class="atom-op">x</span>
        <span class="atom-label">New Element</span>
        <span class="atom-value">${escapeHTML(variant.newElement)}</span>
      </div>
      <div class="formula-line">${escapeHTML(brief.assetXElement)} — ${escapeHTML(variant.workingTitle)}</div>
    </header>

    <div class="variant-body">
      <div class="variant-media">
        ${imgURI ? `<img src="${imgURI}" alt="${escapeHTML(stillNamed?.name ?? "")}" />` : `<div class="media-placeholder">motion only, no still</div>`}
      </div>

      <div class="variant-meta">
        <div class="meta-row"><span class="meta-key">audience</span><span class="meta-val">${escapeHTML(brief.audience)}</span></div>
        <div class="meta-row"><span class="meta-key">insight</span><span class="meta-val">${escapeHTML(brief.insight)}</span></div>
        <div class="meta-row"><span class="meta-key">angle type</span><span class="meta-val">${escapeHTML(variant.angleType)}</span></div>
        <div class="meta-row"><span class="meta-key">success metric</span><span class="meta-val">${escapeHTML(brief.successMetric)}</span></div>
        <div class="meta-row"><span class="meta-key">still name</span><span class="meta-val mono">${escapeHTML(stillNamed?.name ?? "")}</span></div>
        <div class="meta-row"><span class="meta-key">motion name</span><span class="meta-val mono">${escapeHTML(motionNamed?.name ?? "")}</span></div>
        <div class="badges">
          ${judgeBadge(stillJudge)} ${judgeBadge(motionJudge)} ${stillDecision ? verdictBadge(stillDecision.verdict) : ""} ${sourceBadge(stillDecision?.source)}
        </div>
      </div>
    </div>

    <div class="prompts">
      <div class="prompt-block">
        <div class="prompt-label">image prompt</div>
        <pre>${escapeHTML(brief.generationPrompts.image)}</pre>
      </div>
      <div class="prompt-block">
        <div class="prompt-label">motion prompt</div>
        <pre>${escapeHTML(brief.generationPrompts.motion)}</pre>
      </div>
      <div class="prompt-block">
        <div class="prompt-label">copy prompt</div>
        <pre>${escapeHTML(brief.generationPrompts.copy)}</pre>
      </div>
    </div>

    ${
      stillCurve && stillDecision
        ? `<div class="curves">
      <div class="curve-block">
        <div class="curve-label">predicted CTR${hasMeasured ? " vs measured engagementRate" : ""}, 21 days, final ${(stillDecision.finalCTR * 100).toFixed(2)}%</div>
        ${ctrCurve}
        ${curveLegend(hasMeasured, "#1a1a1a")}
      </div>
      <div class="curve-block">
        <div class="curve-label">share rate, 21 days</div>
        ${shareCurve}
      </div>
      <div class="decision-reason">${escapeHTML(stillDecision.reason)}</div>
    </div>`
        : ""
    }
  </article>`;
}

function librarySection(libraryEntries: LearningEntry[] | undefined): string {
  if (!libraryEntries || libraryEntries.length === 0) return "";
  const rows = libraryEntries
    .map((entry) => {
      const winnerBadges =
        entry.winners.length > 0
          ? entry.winners
              .map((w) => {
                const source = entry.sources?.[w] ?? "simulated";
                return `<span class="lib-winner"><span class="mono">${escapeHTML(w)}</span> ${sourceBadge(source)}</span>`;
              })
              .join("")
          : `<span class="lib-none">no SCALE verdicts</span>`;
      return `<div class="lib-row">
        <div class="lib-wave">wave ${entry.wave}</div>
        <div class="lib-winners">${winnerBadges}</div>
      </div>`;
    })
    .join("");
  return `<div class="library-summary">
    <span class="learnings-label">library — cross-wave winners</span>
    ${rows}
  </div>`;
}

export async function renderReport(readout: WaveReadout, libraryEntries?: LearningEntry[]): Promise<string> {
  const cards = await Promise.all(
    readout.variants.map((variant) => {
      const brief = readout.briefs.find((b) => b.variantId === variant.id)!;
      const stillNamed = readout.namedAssets.find((n) => n.variantId === variant.id && n.format === "still");
      const motionNamed = readout.namedAssets.find((n) => n.variantId === variant.id && n.format === "motion");
      const stillProduced = readout.produced.find((p) => p.variantId === variant.id && p.format === "still");
      const motionProduced = readout.produced.find((p) => p.variantId === variant.id && p.format === "motion");
      const stillJudge = readout.judged.find((j) => j.variantId === variant.id && j.format === "still");
      const motionJudge = readout.judged.find((j) => j.variantId === variant.id && j.format === "motion");
      const stillCurve = readout.simulated.find((s) => s.variantId === variant.id && s.format === "still");
      const stillDecision = readout.decided.find((d) => d.variantId === variant.id && d.format === "still");
      const stillMeasured = readout.measured?.find((m) => m.variantId === variant.id && m.format === "still");
      return renderVariantCard({
        variant,
        brief,
        stillNamed,
        motionNamed,
        stillProduced,
        motionProduced,
        stillJudge,
        motionJudge,
        stillCurve,
        stillDecision,
        stillMeasured,
      });
    })
  );

  const learningsBlock = readout.injectedLearnings
    ? `<div class="learnings"><span class="learnings-label">carried forward from last wave</span><p>${escapeHTML(readout.injectedLearnings)}</p></div>`
    : `<div class="learnings"><span class="learnings-label">first wave</span><p>no prior learnings to carry forward.</p></div>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>The Growth Machine &middot; ${escapeHTML(readout.moment)} &middot; wave ${readout.waveNumber}</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #fdfcf9;
    color: #1a1a1a;
    font-family: -apple-system, "Helvetica Neue", Arial, sans-serif;
    line-height: 1.5;
  }
  .wrap { max-width: 920px; margin: 0 auto; padding: 48px 24px 96px; }
  header.masthead { border-bottom: 2px solid #1a1a1a; padding-bottom: 20px; margin-bottom: 36px; }
  header.masthead h1 { font-family: Georgia, "Times New Roman", serif; font-size: 34px; margin: 0 0 6px; }
  header.masthead .sub { color: #6b6b63; font-size: 14px; }
  .learnings { border: 1px solid #d8d5cd; background: #f6f4ee; padding: 16px 20px; margin-bottom: 24px; }
  .learnings-label { text-transform: uppercase; letter-spacing: 0.06em; font-size: 11px; color: #8a8779; }
  .learnings p { margin: 8px 0 0; font-size: 14px; }
  .library-summary { border: 1px solid #d8d5cd; padding: 16px 20px; margin-bottom: 40px; }
  .lib-row { display: flex; gap: 14px; align-items: baseline; padding: 6px 0; border-top: 1px solid #f0eee7; font-size: 12px; }
  .lib-row:first-of-type { border-top: none; margin-top: 8px; }
  .lib-wave { min-width: 60px; color: #8a8779; text-transform: uppercase; letter-spacing: 0.04em; font-size: 10px; }
  .lib-winners { display: flex; flex-wrap: wrap; gap: 10px; }
  .lib-winner { display: inline-flex; align-items: center; gap: 6px; }
  .lib-none { color: #a8a59c; font-style: italic; }
  .variant-card { border-top: 1px solid #d8d5cd; padding: 32px 0; }
  .variant-card:first-of-type { border-top: none; }
  .atom-line { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; font-size: 13px; }
  .atom-label { color: #8a8779; text-transform: uppercase; letter-spacing: 0.05em; font-size: 10px; }
  .atom-value { font-weight: 600; }
  .atom-op { color: #8a8779; }
  .formula-line { font-family: Georgia, serif; font-size: 22px; margin-top: 6px; }
  .variant-body { display: grid; grid-template-columns: 320px 1fr; gap: 24px; margin: 20px 0; }
  .variant-media img { width: 100%; height: auto; border: 1px solid #d8d5cd; display: block; }
  .media-placeholder { border: 1px dashed #d8d5cd; padding: 40px 12px; text-align: center; color: #8a8779; font-size: 13px; }
  .meta-row { display: flex; gap: 10px; font-size: 13px; padding: 4px 0; border-bottom: 1px solid #f0eee7; }
  .meta-key { min-width: 110px; color: #8a8779; text-transform: uppercase; letter-spacing: 0.04em; font-size: 10px; padding-top: 2px; }
  .meta-val { flex: 1; }
  .mono { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 12px; }
  .badges { margin-top: 10px; display: flex; gap: 6px; flex-wrap: wrap; }
  .badge { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; padding: 3px 8px; border: 1px solid #1a1a1a; }
  .badge-scale { background: #1a1a1a; color: #fff; }
  .badge-kill { background: #fff; color: #1a1a1a; }
  .badge-iterate { background: #f0eee7; color: #1a1a1a; }
  .badge-pass { border-color: #6b8f6b; color: #4a6b4a; }
  .badge-fail { border-color: #a85c5c; color: #8a3f3f; }
  .badge-measured { border-color: #c2410c; color: #c2410c; }
  .badge-simulated { border-color: #8a8779; color: #8a8779; }
  .prompts { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; margin: 20px 0; }
  .prompt-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #8a8779; margin-bottom: 6px; }
  .prompt-block pre {
    background: #14140f; color: #e8e5dd; font-size: 11px; padding: 12px; margin: 0;
    white-space: pre-wrap; word-break: break-word; max-height: 220px; overflow: auto;
  }
  .curves { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; margin-top: 16px; }
  .curve-label { font-size: 11px; color: #8a8779; margin-bottom: 6px; }
  .curve-legend { display: flex; gap: 14px; margin-top: 6px; font-size: 10px; color: #8a8779; }
  .legend-item { display: inline-flex; align-items: center; gap: 5px; }
  .legend-swatch { display: inline-block; width: 16px; height: 0; }
  .legend-dashed { border-top: 2px dashed #1a1a1a; }
  .legend-solid { height: 3px; background: #c2410c; }
  .decision-reason { grid-column: 1 / -1; font-size: 13px; border-left: 3px solid #1a1a1a; padding-left: 12px; margin-top: 4px; }
  footer.colophon { margin-top: 60px; padding-top: 20px; border-top: 1px solid #d8d5cd; font-size: 11px; color: #8a8779; }
  @media (max-width: 640px) {
    .variant-body { grid-template-columns: 1fr; }
    .prompts { grid-template-columns: 1fr; }
    .curves { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>
  <div class="wrap">
    <header class="masthead">
      <h1>The Growth Machine</h1>
      <div class="sub">moment: ${escapeHTML(readout.moment)} &nbsp;&middot;&nbsp; wave ${readout.waveNumber} &nbsp;&middot;&nbsp; ${readout.plan.dates.start} to ${readout.plan.dates.end}</div>
    </header>

    ${learningsBlock}
    ${librarySection(libraryEntries)}

    ${cards.join("\n")}

    <footer class="colophon">
      generation is real (OpenAI API). market response is simulated (three response models) unless a "measured" badge marks real channel data recorded via <span class="mono">growth-machine measure</span>.
      plan rationale: ${escapeHTML(readout.plan.rationale)}
    </footer>
  </div>
</body>
</html>`;
}
