/**
 * [INPUT]: depends on all nine stages/*.ts files, on lib/fs-utils, on lib/report, on lib/openai-client's isMockMode
 * [OUTPUT]: exports runWave(moment, waveNumber) -> WaveReadout, runs one full wave and writes every artifact to disk
 * [POS]: the assembly line of src/ — cli.ts only parses arguments, the real nine-station chaining logic lives entirely here
 * [PROTOCOL]: update this header on change, then check CLAUDE.md
 */
import path from "node:path";
import { writeFile } from "node:fs/promises";
import { runInsight } from "./stages/insight.js";
import { runBrief } from "./stages/brief.js";
import { runNaming } from "./stages/naming.js";
import { runPlan } from "./stages/plan.js";
import { runProduce } from "./stages/produce.js";
import { runJudge } from "./stages/judge.js";
import { runSimulate } from "./stages/simulate.js";
import { runDecide } from "./stages/decide.js";
import { runLearn, getInjectedLearnings } from "./stages/learn.js";
import { waveDir, writeJSON, readJSONL, LIBRARY_PATH } from "./lib/fs-utils.js";
import { renderReport } from "./lib/report.js";
import type {
  Brief,
  Decision,
  JudgeResult,
  LearningEntry,
  NamedAsset,
  ProducedAsset,
  SimulatedCurve,
  WaveReadout,
} from "./types.js";

export async function runWave(moment: string, waveNumber: number): Promise<WaveReadout> {
  const dir = waveDir(waveNumber);
  const assetsDir = path.join(dir, "assets");

  // ---- station 1: insight ----
  const injectedLearnings = await getInjectedLearnings();
  const insight = await runInsight(moment, waveNumber, injectedLearnings);

  // ---- station 2: brief (one page per variant) ----
  const briefs: Brief[] = [];
  for (const variant of insight.variants) {
    const brief = await runBrief(variant, moment);
    briefs.push(brief);
    await writeJSON(path.join(dir, `brief-${variant.id}.json`), brief);
  }

  // ---- station 3: naming (deterministic, no LLM) ----
  const namedAssets: NamedAsset[] = [];
  for (const variant of insight.variants) {
    const brief = briefs.find((b) => b.variantId === variant.id)!;
    for (const format of ["still", "motion"] as const) {
      namedAssets.push(
        runNaming({ variant, format, moment, audience: brief.audience, version: waveNumber })
      );
    }
  }

  // ---- station 4: plan ----
  const plan = await runPlan(moment, waveNumber, insight.variants, namedAssets);
  await writeJSON(path.join(dir, "plan.json"), plan);

  // ---- stations 5 + 6: produce + judge (per asset, judge failure triggers up to one regeneration) ----
  const produced: ProducedAsset[] = [];
  const judged: JudgeResult[] = [];
  for (const namedAsset of namedAssets) {
    const brief = briefs.find((b) => b.variantId === namedAsset.variantId)!;
    const initial = await runProduce(assetsDir, namedAsset, brief);
    const { produced: finalProduced, judgeResult } = await runJudge(assetsDir, namedAsset, brief, initial);
    produced.push(finalProduced);
    judged.push(judgeResult);
  }

  // ---- station 7: simulate (only still assets get a three-week curve; motion never enters the media curve) ----
  const simulated: SimulatedCurve[] = [];
  for (const namedAsset of namedAssets.filter((n) => n.format === "still")) {
    const variant = insight.variants.find((v) => v.id === namedAsset.variantId)!;
    simulated.push(runSimulate(namedAsset, variant.angleType, plan.dates.days, waveNumber));
  }

  // ---- station 8: decide ----
  const decided: Decision[] = simulated.map((curve) => runDecide(curve, plan));

  // ---- station 9: learn (commit winning traits, ready to inject into the next wave) ----
  await runLearn(waveNumber, moment, insight.variants, namedAssets, decided);

  const readout: WaveReadout = {
    moment,
    waveNumber,
    variants: insight.variants,
    briefs,
    namedAssets,
    plan,
    produced,
    judged,
    simulated,
    decided,
    measured: [],
    injectedLearnings,
  };

  await writeJSON(path.join(dir, "readout.json"), readout);

  const libraryEntries = await readJSONL<LearningEntry>(LIBRARY_PATH);
  const html = await renderReport(readout, libraryEntries);
  await writeFile(path.join(dir, "report.html"), html, "utf-8");

  return readout;
}
