/**
 * [INPUT]: depends on src/stages/naming.js, src/stages/plan.js, src/stages/simulate.js,
 *   src/stages/decide.js, src/stages/learn.js, src/lib/fs-utils.js, src/lib/report.js, src/types.js
 * [OUTPUT]: exports pure stage functions (nameStage/simulateStage/decideStage) and fs-effecting
 *   stage functions (planStage/reportStage/learnCommit/learnGet/learnLast) for tests to import
 *   directly; running this file (via tsx) also dispatches a stdin-JSON-in / stdout-JSON-out CLI
 * [POS]: the real logic behind scripts/machine.mjs — the skill layer's deterministic half. An
 *   agent (Claude Code / Codex) running the growth-machine skill calls the six scripted stations
 *   (naming/plan/simulate/decide/report/learn) through this file; insight/brief/judge/produce stay
 *   LLM-native and live in the skill's prompt instructions, not here
 * [PROTOCOL]: update this header on change, then check CLAUDE.md
 */
import path from "node:path";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { runNaming } from "../src/stages/naming.js";
import { runPlan } from "../src/stages/plan.js";
import { runSimulate } from "../src/stages/simulate.js";
import { runDecide } from "../src/stages/decide.js";
import { runLearn, getInjectedLearnings, getLastRunState } from "../src/stages/learn.js";
import { waveDir, writeJSON, readJSONL, LIBRARY_PATH } from "../src/lib/fs-utils.js";
import { renderReport } from "../src/lib/report.js";
import type {
  Decision,
  LearningEntry,
  NamedAsset,
  Plan,
  SimulatedCurve,
  Variant,
  WaveReadout,
} from "../src/types.js";

// ============================================================
// station 3 — naming (pure, no LLM, no fs). Mirrors orchestrator's loop:
// every variant gets both a still and a motion name.
// ============================================================
export interface NameInput {
  moment: string;
  waveNumber: number;
  variants: Variant[];
  audienceByVariant: Record<string, string>; // variantId -> brief.audience
}

export function nameStage(input: NameInput): NamedAsset[] {
  const out: NamedAsset[] = [];
  for (const variant of input.variants) {
    const audience = input.audienceByVariant[variant.id] ?? "general audience";
    for (const format of ["still", "motion"] as const) {
      out.push(
        runNaming({ variant, format, moment: input.moment, audience, version: input.waveNumber })
      );
    }
  }
  return out;
}

// ============================================================
// station 4 — plan (rules + one LLM rationale sentence, mock in no-API-key
// environments). Writes plan.json alongside returning the Plan.
// ============================================================
export interface PlanInput {
  moment: string;
  waveNumber: number;
  variants: Variant[];
  namedAssets: NamedAsset[];
}

export async function planStage(input: PlanInput): Promise<Plan> {
  const plan = await runPlan(input.moment, input.waveNumber, input.variants, input.namedAssets);
  await writeJSON(path.join(waveDir(input.waveNumber), "plan.json"), plan);
  return plan;
}

// ============================================================
// station 7 — simulate (pure, seeded off asset name). Only still assets
// enter the media curve; motion never gets simulated.
// ============================================================
export interface SimulateInput {
  namedAssets: NamedAsset[];
  variants: Variant[];
  days: number;
  waveNumber: number;
}

export function simulateStage(input: SimulateInput): SimulatedCurve[] {
  return input.namedAssets
    .filter((n) => n.format === "still")
    .map((na) => {
      const variant = input.variants.find((v) => v.id === na.variantId);
      if (!variant) throw new Error(`simulate: no variant found for ${na.variantId}`);
      return runSimulate(na, variant.angleType, input.days, input.waveNumber);
    });
}

// ============================================================
// station 8 — decide (pure rules, thresholds come from plan.json).
// ============================================================
export interface DecideInput {
  simulated: SimulatedCurve[];
  plan: Plan;
}

export function decideStage(input: DecideInput): Decision[] {
  return input.simulated.map((curve) => runDecide(curve, input.plan));
}

// ============================================================
// terminal station — report. Persists readout.json + renders report.html,
// exactly what orchestrator.ts does at the tail of a normal run. Returns the
// two paths written so the caller (agent) can point the user at them.
// ============================================================
export interface ReportInput {
  readout: WaveReadout;
  libraryEntries?: LearningEntry[];
}

export async function reportStage(
  input: ReportInput
): Promise<{ readoutPath: string; reportPath: string }> {
  const dir = waveDir(input.readout.waveNumber);
  const readoutPath = path.join(dir, "readout.json");
  await writeJSON(readoutPath, input.readout);

  const libraryEntries = input.libraryEntries ?? (await readJSONL<LearningEntry>(LIBRARY_PATH));
  const html = await renderReport(input.readout, libraryEntries);
  const reportPath = path.join(dir, "report.html");
  await writeFile(reportPath, html, "utf-8");

  return { readoutPath, reportPath };
}

// ============================================================
// station 9 — learn. Three sub-verbs: commit (append library.jsonl, the
// normal end-of-wave path), get (read injected learnings for the next
// wave's insight/brief prompts — the agent calls this before it starts
// wave N+1), last (reconstruct moment + last wave number for a "continue"
// flow, mirroring cli.ts's `next` command).
// ============================================================
export interface LearnCommitInput {
  waveNumber: number;
  moment: string;
  variants: Variant[];
  namedAssets: NamedAsset[];
  decisions: Decision[];
}

export async function learnCommit(input: LearnCommitInput): Promise<LearningEntry> {
  return runLearn(input.waveNumber, input.moment, input.variants, input.namedAssets, input.decisions);
}

export async function learnGet(): Promise<{ injectedLearnings: string | null }> {
  return { injectedLearnings: await getInjectedLearnings() };
}

export async function learnLast(): Promise<{ moment: string; lastWave: number } | null> {
  return getLastRunState();
}

// ============================================================
// CLI glue: stdin JSON in, stdout JSON out. Only runs when this file is
// executed directly (by tsx, via scripts/machine.mjs) — importing these
// exports from a test file never triggers it.
// ============================================================
async function readStdinJSON<T>(): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf-8").trim();
  if (!raw) throw new Error("expected JSON on stdin, got empty input");
  return JSON.parse(raw) as T;
}

function printJSON(data: unknown): void {
  process.stdout.write(JSON.stringify(data, null, 2) + "\n");
}

function printUsage(): void {
  console.error(
    `usage: machine.mjs <stage> [sub] < in.json > out.json
  name              stdin NameInput          -> NamedAsset[]
  plan              stdin PlanInput          -> Plan (writes waves/wave-NN/plan.json)
  simulate          stdin SimulateInput      -> SimulatedCurve[]
  decide            stdin DecideInput        -> Decision[]
  report            stdin ReportInput        -> {readoutPath, reportPath} (writes both files)
  learn commit      stdin LearnCommitInput   -> LearningEntry (appends library.jsonl)
  learn get         (no stdin)               -> {injectedLearnings}
  learn last        (no stdin)               -> {moment, lastWave} | null`
  );
}

async function main(): Promise<void> {
  const [stage, sub] = process.argv.slice(2);
  switch (stage) {
    case "name":
      printJSON(nameStage(await readStdinJSON<NameInput>()));
      break;
    case "plan":
      printJSON(await planStage(await readStdinJSON<PlanInput>()));
      break;
    case "simulate":
      printJSON(simulateStage(await readStdinJSON<SimulateInput>()));
      break;
    case "decide":
      printJSON(decideStage(await readStdinJSON<DecideInput>()));
      break;
    case "report":
      printJSON(await reportStage(await readStdinJSON<ReportInput>()));
      break;
    case "learn":
      if (sub === "get") printJSON(await learnGet());
      else if (sub === "last") printJSON(await learnLast());
      else printJSON(await learnCommit(await readStdinJSON<LearnCommitInput>()));
      break;
    default:
      printUsage();
      process.exitCode = 1;
  }
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectExecution) {
  main().catch((err) => {
    console.error("[machine] fatal:", err instanceof Error ? err.stack ?? err.message : err);
    process.exitCode = 1;
  });
}
