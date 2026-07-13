/**
 * [INPUT]: depends on node:util's parseArgs (native, no third-party CLI framework), on orchestrator.ts's runWave, on stages/learn.ts's getLastRunState, on stages/measure.ts's runMeasure/loadMeasuredInputFile/collectInteractiveEntries, on lib/openai-client's setForcedMock/isMockMode
 * [OUTPUT]: exports the CLI entry point —— `growth-machine run "<moment>" [--waves N] [--mock]`, `growth-machine next`, `growth-machine measure --wave N [--file metrics.json]`
 * [POS]: the direct target of bin/growth-machine, the sole executable entry point of src/
 * [PROTOCOL]: update this header on change, then check CLAUDE.md
 */
import { parseArgs } from "node:util";
import { runWave } from "./orchestrator.js";
import { getLastRunState } from "./stages/learn.js";
import { runMeasure, loadMeasuredInputFile, collectInteractiveEntries } from "./stages/measure.js";
import { setForcedMock, isMockMode } from "./lib/openai-client.js";

function printUsage(): void {
  console.log(`The Growth Machine

usage:
  growth-machine run "<moment>" [--waves N] [--mock]        run N waves (default 1)
  growth-machine next                                        continue from library.jsonl's last wave
  growth-machine measure --wave N [--file metrics.json]      record real channel data against a wave's assets

env vars:
  OPENAI_API_KEY   missing -> forced mock
  MODEL            default gpt-5.4
  IMAGE_MODEL      default gpt-image-2, falls back to gpt-image-1 on a 404/unknown-model error
  BRAND_PACK       optional brand/<pack> name (e.g. "openai"); unset -> judge's brandFit dimension defaults to 2
`);
}

async function runCommand(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      waves: { type: "string", default: "1" },
      mock: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  const moment = positionals[0];
  if (!moment) {
    console.error('missing moment argument. usage: growth-machine run "<moment>" [--waves N] [--mock]');
    process.exitCode = 1;
    return;
  }

  setForcedMock(Boolean(values.mock));
  const waves = Math.max(1, parseInt(String(values.waves), 10) || 1);

  console.log(`[growth-machine] moment="${moment}" waves=${waves} mock=${isMockMode()}`);

  for (let w = 1; w <= waves; w++) {
    console.log(`\n[growth-machine] --- wave ${w}/${waves} ---`);
    const readout = await runWave(moment, w);
    const scaleCount = readout.decided.filter((d) => d.verdict === "SCALE").length;
    const killCount = readout.decided.filter((d) => d.verdict === "KILL").length;
    const iterateCount = readout.decided.filter((d) => d.verdict === "ITERATE").length;
    console.log(
      `[growth-machine] wave ${w} done: ${readout.variants.length} variants, ${readout.produced.length} assets produced, decide = SCALE:${scaleCount} KILL:${killCount} ITERATE:${iterateCount}`
    );
  }

  console.log(`\n[growth-machine] complete. see waves/wave-NN/report.html`);
}

async function nextCommand(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      mock: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  setForcedMock(Boolean(values.mock));

  const state = await getLastRunState();
  if (!state) {
    console.error("library.jsonl is empty, nothing to continue from. Run `growth-machine run` first.");
    process.exitCode = 1;
    return;
  }

  const nextWave = state.lastWave + 1;
  console.log(`[growth-machine] continuing moment="${state.moment}" wave=${nextWave} mock=${isMockMode()}`);
  const readout = await runWave(state.moment, nextWave);
  console.log(`[growth-machine] wave ${nextWave} done: ${readout.produced.length} assets produced`);
}

async function measureCommand(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      wave: { type: "string" },
      file: { type: "string" },
    },
    allowPositionals: true,
  });

  const waveNumber = parseInt(String(values.wave ?? ""), 10);
  if (!waveNumber || waveNumber < 1) {
    console.error("missing or invalid --wave N. usage: growth-machine measure --wave N [--file metrics.json]");
    process.exitCode = 1;
    return;
  }

  const entries = values.file
    ? (await loadMeasuredInputFile(String(values.file))).entries
    : await collectInteractiveEntries(waveNumber);

  if (entries.length === 0) {
    console.log("[growth-machine] no entries recorded, nothing to measure");
    return;
  }

  console.log(`[growth-machine] measuring wave ${waveNumber}: ${entries.length} channel reading(s)`);
  const readout = await runMeasure(waveNumber, entries);
  const measuredCount = readout.measured.length;
  const scaleCount = readout.decided.filter((d) => d.verdict === "SCALE" && d.source === "measured").length;
  console.log(
    `[growth-machine] wave ${waveNumber} measured: ${measuredCount} asset(s) now carry real data, ${scaleCount} SCALE verdict(s) backed by measured engagementRate`
  );
  console.log(`[growth-machine] report.html and library.jsonl updated in place.`);
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);

  if (command === "run") {
    await runCommand(rest);
  } else if (command === "next") {
    await nextCommand(rest);
  } else if (command === "measure") {
    await measureCommand(rest);
  } else {
    printUsage();
    process.exitCode = command ? 1 : 0;
  }
}

main().catch((err) => {
  console.error("[growth-machine] fatal:", err instanceof Error ? err.stack ?? err.message : err);
  process.exitCode = 1;
});
