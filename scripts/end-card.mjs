#!/usr/bin/env node
// [INPUT]: depends on playwright (devDependency, chromium only) to rasterize an HTML template
//   to PNG; the OpenAI mark is the real single-color knot glyph (viewBox 0 0 320 320, one <path>,
//   sourced from Wikimedia Commons' public OpenAI logo file, verified by render before use, not
//   hand-drawn) embedded inline so the renderer has no network or asset-path dependency at run
//   time. Typography follows this repo's established display/sans pairing (Playfair Display for
//   the CTA line, Helvetica Neue for the wordmark and support line), matching brand/openai/
//   design.md's "generous negative space, one thing carries the frame" register rather than
//   inventing a new type system per card.
// [OUTPUT]: single entry point — `node scripts/end-card.mjs --primary "..." [--secondary "..."]
//   [--register paper|dark] [--out path.png] [--width 1080] [--height 1920]` — writes one
//   branded end-card PNG: OpenAI mark, CTA headline, "Made with ChatGPT" wordmark line, generous
//   margins, no other graphic elements.
// [POS]: the reusable design-system layer for every wave's video end card. Wave rollout assembly
//   scripts call this once per CTA variant, then ffmpeg composites the PNG as a held final frame
//   (this machine's ffmpeg has no drawtext filter — see scripts/record-theater.mjs's header —
//   so text always gets pre-rendered here, never composited live in ffmpeg).
// [PROTOCOL]: update this header on change, then check CLAUDE.md
import { chromium } from "playwright";
import { parseArgs } from "node:util";
import path from "node:path";
import { mkdir } from "node:fs/promises";

// The OpenAI mark: one <path>, monochrome, no wrapper background. Verified against
// Wikimedia Commons' public OpenAI logo asset before embedding — this is the real glyph,
// not an approximation. fill is set at render time via currentColor so one path serves
// both the dark and paper register.
const MARK_PATH =
  "m297.06 130.97c7.26-21.79 4.76-45.66-6.85-65.48-17.46-30.4-52.56-46.04-86.84-38.68-15.25-17.18-37.16-26.95-60.13-26.81-35.04-.08-66.13 22.48-76.91 55.82-22.51 4.61-41.94 18.7-53.31 38.67-17.59 30.32-13.58 68.54 9.92 94.54-7.26 21.79-4.76 45.66 6.85 65.48 17.46 30.4 52.56 46.04 86.84 38.68 15.24 17.18 37.16 26.95 60.13 26.8 35.06.09 66.16-22.49 76.94-55.86 22.51-4.61 41.94-18.7 53.31-38.67 17.57-30.32 13.55-68.51-9.94-94.51zm-120.28 168.11c-14.03.02-27.62-4.89-38.39-13.88.49-.26 1.34-.73 1.89-1.07l63.72-36.8c3.26-1.85 5.26-5.32 5.24-9.07v-89.83l26.93 15.55c.29.14.48.42.52.74v74.39c-.04 33.08-26.83 59.9-59.91 59.97zm-128.84-55.03c-7.03-12.14-9.56-26.37-7.15-40.18.47.28 1.3.79 1.89 1.13l63.72 36.8c3.23 1.89 7.23 1.89 10.47 0l77.79-44.92v31.1c.02.32-.13.63-.38.83l-64.41 37.19c-28.69 16.52-65.33 6.7-81.92-21.95zm-16.77-139.09c7-12.16 18.05-21.46 31.21-26.29 0 .55-.03 1.52-.03 2.2v73.61c-.02 3.74 1.98 7.21 5.23 9.06l77.79 44.91-26.93 15.55c-.27.18-.61.21-.91.08l-64.42-37.22c-28.63-16.58-38.45-53.21-21.95-81.89zm221.26 51.49-77.79-44.92 26.93-15.54c.27-.18.61-.21.91-.08l64.42 37.19c28.68 16.57 38.51 53.26 21.94 81.94-7.01 12.14-18.05 21.44-31.2 26.28v-75.81c.03-3.74-1.96-7.2-5.2-9.06zm26.8-40.34c-.47-.29-1.3-.79-1.89-1.13l-63.72-36.8c-3.23-1.89-7.23-1.89-10.47 0l-77.79 44.92v-31.1c-.02-.32.13-.63.38-.83l64.41-37.16c28.69-16.55 65.37-6.7 81.91 22 6.99 12.12 9.52 26.31 7.15 40.1zm-168.51 55.43-26.94-15.55c-.29-.14-.48-.42-.52-.74v-74.39c.02-33.12 26.89-59.96 60.01-59.94 14.01 0 27.57 4.92 38.34 13.88-.49.26-1.33.73-1.89 1.07l-63.72 36.8c-3.26 1.85-5.26 5.31-5.24 9.06l-.04 89.79zm14.63-31.54 34.65-20.01 34.65 20v40.01l-34.65 20-34.65-20z";

const REGISTERS = {
  paper: { bg: "#f7f6f3", ink: "#1a1a1a", muted: "#66686a", grain: 0.03 },
  dark: { bg: "#0d0d0d", ink: "#f7f6f3", muted: "#9a9a9a", grain: 0.05 },
};

function buildHtml({ primary, secondary, register, width, height }) {
  const r = REGISTERS[register];
  // Headline scales down for long CTA lines so nothing ever clips inside the safe margin.
  const headlineSize = primary.length > 22 ? 56 : primary.length > 14 ? 66 : 76;
  return `<!doctype html>
<html><head><meta charset="utf-8" />
<style>
  :root {
    --paper: ${r.bg}; --ink: ${r.ink}; --muted: ${r.muted};
    --font-display: "Playfair Display", Georgia, "Times New Roman", serif;
    --font-sans: "Helvetica Neue", Helvetica, Arial, sans-serif;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${width}px; height: ${height}px; background: var(--paper); overflow: hidden; }
  .stage {
    width: 100%; height: 100%; position: relative;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 40px;
  }
  .mark { width: 72px; height: 72px; fill: var(--ink); opacity: 0.92; }
  .primary {
    font-family: var(--font-display); font-weight: 400; color: var(--ink);
    font-size: ${headlineSize}px; line-height: 1.2; text-align: center;
    max-width: 84%; letter-spacing: 0.002em;
  }
  .secondary {
    font-family: var(--font-sans); font-weight: 400; color: var(--muted);
    font-size: 26px; letter-spacing: 0.01em; text-align: center;
  }
  .grain {
    position: absolute; inset: 0; pointer-events: none; opacity: ${r.grain};
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  }
</style></head>
<body>
  <div class="stage">
    <div class="grain"></div>
    <svg class="mark" viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg"><path d="${MARK_PATH}"/></svg>
    <div class="primary">${primary}</div>
    <div class="secondary">${secondary}</div>
  </div>
</body></html>`;
}

async function main() {
  const { values } = parseArgs({
    options: {
      primary: { type: "string" },
      secondary: { type: "string", default: "Made with ChatGPT" },
      register: { type: "string", default: "paper" },
      out: { type: "string" },
      width: { type: "string", default: "1080" },
      height: { type: "string", default: "1920" },
    },
  });

  if (!values.primary || !values.out) {
    console.error(
      '[end-card] usage: node scripts/end-card.mjs --primary "Bring yours back." --out path.png [--secondary "Made with ChatGPT"] [--register paper|dark] [--width 1080] [--height 1920]'
    );
    process.exitCode = 1;
    return;
  }
  if (!REGISTERS[values.register]) {
    console.error(`[end-card] unknown register "${values.register}", expected paper or dark`);
    process.exitCode = 1;
    return;
  }

  const width = Number(values.width);
  const height = Number(values.height);
  const html = buildHtml({
    primary: values.primary,
    secondary: values.secondary,
    register: values.register,
    width,
    height,
  });

  const outPath = path.resolve(values.out);
  await mkdir(path.dirname(outPath), { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width, height } });
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.screenshot({ path: outPath });
  await browser.close();

  console.log(`[end-card] wrote ${outPath} (${width}x${height}, register=${values.register})`);
}

main().catch((err) => {
  console.error("[end-card] fatal:", err instanceof Error ? err.stack ?? err.message : err);
  process.exitCode = 1;
});
