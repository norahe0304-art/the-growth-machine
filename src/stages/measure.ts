/**
 * [INPUT]: depends on lib/fs-utils's readJSON/writeJSON/readJSONL/fileExists/waveDir, on lib/prompt's createPrompter, on stages/plan.ts's ENGAGEMENT_THRESHOLDS, on stages/decide.ts's runDecideMeasured, on stages/learn.ts's updateLibraryEntry, on lib/report.ts's renderReport
 * [OUTPUT]: exports computeEngagementRate() / normalizeInputEntry() / mergeReadings() / runMeasure(waveNumber, entries) -> WaveReadout, and collectInteractiveEntries() for the CLI's interactive path
 * [POS]: the tenth, post-hoc station — turns the simulator into an instrument. Runs after a wave has already been produced; reads real channel data, re-decides the assets it covers against ENGAGEMENT_THRESHOLDS, and rewrites that wave's readout/report/library entry in place
 * [PROTOCOL]: update this header on change, then check CLAUDE.md
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import {
  readJSON,
  writeJSON,
  readJSONL,
  fileExists,
  waveDir,
  LIBRARY_PATH,
} from "../lib/fs-utils.js";
import { createPrompter } from "../lib/prompt.js";
import { ENGAGEMENT_THRESHOLDS } from "./plan.js";
import { runDecideMeasured } from "./decide.js";
import { updateLibraryEntry } from "./learn.js";
import { renderReport } from "../lib/report.js";
import type {
  Channel,
  Decision,
  LearningEntry,
  MeasuredAssetSummary,
  MeasuredChannelMetrics,
  MeasuredInputEntry,
  MeasuredInputFile,
  MeasuredReading,
  WaveReadout,
} from "../types.js";

const CHANNELS: Channel[] = ["x", "xiaohongshu", "linkedin"];

export function computeEngagementRate(m: MeasuredChannelMetrics): number {
  if (m.impressions <= 0) return 0;
  const engaged = m.likes + m.comments + m.shares + m.saves;
  return Math.max(0, engaged / m.impressions);
}

function measuredJsonPath(waveNumber: number): string {
  return path.join(waveDir(waveNumber), "measured.json");
}

function defaultDayFor(plan: WaveReadout["plan"]): number {
  const start = new Date(plan.dates.start).getTime();
  const elapsedDays = Math.floor((Date.now() - start) / (24 * 60 * 60 * 1000)) + 1;
  return Math.min(Math.max(elapsedDays, 1), plan.dates.days);
}

export function normalizeInputEntry(entry: MeasuredInputEntry, defaultDay: number): { reading: MeasuredReading; assetName: string } {
  if (entry.impressions <= 0) {
    throw new Error(`measure: "${entry.assetName}" has impressions <= 0, cannot compute engagementRate`);
  }
  for (const field of ["likes", "comments", "shares", "saves"] as const) {
    if (entry[field] < 0) throw new Error(`measure: "${entry.assetName}".${field} cannot be negative`);
  }
  const metrics: MeasuredChannelMetrics = {
    channel: entry.channel,
    impressions: entry.impressions,
    likes: entry.likes,
    comments: entry.comments,
    shares: entry.shares,
    saves: entry.saves,
  };
  const day = entry.day ?? defaultDay;
  return {
    assetName: entry.assetName,
    reading: { day, engagementRate: computeEngagementRate(metrics), metrics },
  };
}

// merges new readings into existing per-asset history, de-duping same-day
// entries (a re-run of `measure` for a day that's already recorded
// overwrites it) and keeping the series sorted ascending by day
export function mergeReadings(existing: MeasuredReading[], incoming: MeasuredReading[]): MeasuredReading[] {
  const byDay = new Map<number, MeasuredReading>();
  for (const r of existing) byDay.set(r.day, r);
  for (const r of incoming) byDay.set(r.day, r);
  return [...byDay.values()].sort((a, b) => a.day - b.day);
}

async function loadMeasuredSummaries(waveNumber: number): Promise<MeasuredAssetSummary[]> {
  const p = measuredJsonPath(waveNumber);
  if (!(await fileExists(p))) return [];
  return readJSON<MeasuredAssetSummary[]>(p);
}

export async function runMeasure(waveNumber: number, entries: MeasuredInputEntry[]): Promise<WaveReadout> {
  const dir = waveDir(waveNumber);
  const readoutPath = path.join(dir, "readout.json");
  if (!(await fileExists(readoutPath))) {
    throw new Error(`measure: wave ${waveNumber} has no readout.json yet — run "growth-machine run" first`);
  }
  const readout = await readJSON<WaveReadout>(readoutPath);

  const stillAssets = readout.namedAssets.filter((n) => n.format === "still");
  const validNames = new Set(stillAssets.map((n) => n.name));
  for (const e of entries) {
    if (!validNames.has(e.assetName)) {
      throw new Error(
        `measure: "${e.assetName}" is not a still asset in wave ${waveNumber}. Valid names:\n  ${[...validNames].join("\n  ")}`
      );
    }
  }

  const defaultDay = defaultDayFor(readout.plan);
  const existingSummaries = await loadMeasuredSummaries(waveNumber);
  const summaryByName = new Map(existingSummaries.map((s) => [s.assetName, s]));

  for (const raw of entries) {
    const { assetName, reading } = normalizeInputEntry(raw, defaultDay);
    const namedAsset = stillAssets.find((n) => n.name === assetName)!;
    const prior = summaryByName.get(assetName);
    const readings = mergeReadings(prior?.readings ?? [], [reading]);
    summaryByName.set(assetName, {
      assetName,
      variantId: namedAsset.variantId,
      format: "still",
      channel: reading.metrics.channel,
      readings,
      engagementRate: readings[readings.length - 1].engagementRate,
    });
  }

  const measuredSummaries = [...summaryByName.values()];
  await writeJSON(measuredJsonPath(waveNumber), measuredSummaries);

  // re-decide every measured asset against ENGAGEMENT_THRESHOLDS, leave
  // everything else exactly as the simulated pass left it
  const measuredDecisions = new Map<string, Decision>();
  for (const summary of measuredSummaries) {
    const variant = readout.variants.find((v) => v.id === summary.variantId)!;
    const decision = runDecideMeasured(summary, ENGAGEMENT_THRESHOLDS[variant.angleType]);
    measuredDecisions.set(`${summary.variantId}#${summary.format}`, decision);
  }
  const decided = readout.decided.map((d) => measuredDecisions.get(`${d.variantId}#${d.format}`) ?? d);

  const updatedReadout: WaveReadout = { ...readout, decided, measured: measuredSummaries };
  await writeJSON(readoutPath, updatedReadout);

  await updateLibraryEntry(waveNumber, readout.moment, readout.variants, readout.namedAssets, decided);

  const libraryEntries = await readJSONL<LearningEntry>(LIBRARY_PATH);
  const html = await renderReport(updatedReadout, libraryEntries);
  await writeFile(path.join(dir, "report.html"), html, "utf-8");

  return updatedReadout;
}

export async function loadMeasuredInputFile(filePath: string): Promise<MeasuredInputFile> {
  const { readFile } = await import("node:fs/promises");
  const raw = await readFile(filePath, "utf-8");
  const parsed = JSON.parse(raw) as MeasuredInputFile;
  if (!Array.isArray(parsed.entries)) {
    throw new Error(`measure: ${filePath} must have an "entries" array`);
  }
  return parsed;
}

// interactive fallback when --file isn't given: prompts once per asset in
// the wave, channel by channel, defaulting quantities to 0 so a quick pass
// through irrelevant assets is just Enter, Enter, Enter
export async function collectInteractiveEntries(waveNumber: number): Promise<MeasuredInputEntry[]> {
  const dir = waveDir(waveNumber);
  const readoutPath = path.join(dir, "readout.json");
  if (!(await fileExists(readoutPath))) {
    throw new Error(`measure: wave ${waveNumber} has no readout.json yet — run "growth-machine run" first`);
  }
  const readout = await readJSON<WaveReadout>(readoutPath);
  const stillAssets = readout.namedAssets.filter((n) => n.format === "still");

  const prompter = createPrompter();
  const entries: MeasuredInputEntry[] = [];
  try {
    console.log(`[measure] wave ${waveNumber} — ${stillAssets.length} still asset(s). Press Enter to skip an asset (impressions=0).`);
    for (const na of stillAssets) {
      console.log(`\n  asset: ${na.name}`);
      const channel = (await prompter.ask("  channel (x/xiaohongshu/linkedin)", "x")) as Channel;
      if (!CHANNELS.includes(channel)) {
        console.log(`  unknown channel "${channel}", skipping asset`);
        continue;
      }
      const impressions = Number(await prompter.ask("  impressions", "0"));
      if (!impressions || impressions <= 0) {
        console.log("  skipped (no impressions)");
        continue;
      }
      const likes = Number(await prompter.ask("  likes", "0"));
      const comments = Number(await prompter.ask("  comments", "0"));
      const shares = Number(await prompter.ask("  shares", "0"));
      const saves = Number(await prompter.ask("  saves", "0"));
      const day = Number(await prompter.ask("  day (within observation window)", String(defaultDayFor(readout.plan))));
      entries.push({ assetName: na.name, channel, impressions, likes, comments, shares, saves, day });
    }
  } finally {
    prompter.close();
  }
  return entries;
}
