/**
 * [INPUT]: 依赖 stages/*.ts 全部九站、lib/fs-utils、lib/report、lib/openai-client 的 isMockMode
 * [OUTPUT]: 对外提供 runWave(moment, waveNumber) -> WaveReadout，跑完一整波并落盘所有产出
 * [POS]: src/ 的流水线总装 —— cli.ts 只负责解析参数，真正的六站串联逻辑全在这里
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
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
import { waveDir, writeJSON } from "./lib/fs-utils.js";
import { renderReport } from "./lib/report.js";
import type {
  Brief,
  Decision,
  JudgeResult,
  NamedAsset,
  ProducedAsset,
  SimulatedCurve,
  WaveReadout,
} from "./types.js";

export async function runWave(moment: string, waveNumber: number): Promise<WaveReadout> {
  const dir = waveDir(waveNumber);
  const assetsDir = path.join(dir, "assets");

  // ---- 站 1: insight ----
  const injectedLearnings = await getInjectedLearnings();
  const insight = await runInsight(moment, waveNumber, injectedLearnings);

  // ---- 站 2: brief (每个变体一页) ----
  const briefs: Brief[] = [];
  for (const variant of insight.variants) {
    const brief = await runBrief(variant, moment);
    briefs.push(brief);
    await writeJSON(path.join(dir, `brief-${variant.id}.json`), brief);
  }

  // ---- 站 3: naming (确定性，无 LLM) ----
  const namedAssets: NamedAsset[] = [];
  for (const variant of insight.variants) {
    const brief = briefs.find((b) => b.variantId === variant.id)!;
    for (const format of ["still", "motion"] as const) {
      namedAssets.push(
        runNaming({ variant, format, moment, audience: brief.audience, version: waveNumber })
      );
    }
  }

  // ---- 站 4: plan ----
  const plan = await runPlan(moment, waveNumber, insight.variants, namedAssets);
  await writeJSON(path.join(dir, "plan.json"), plan);

  // ---- 站 5 + 6: produce + judge (逐资产跑，judge 失败触发最多一次重生成) ----
  const produced: ProducedAsset[] = [];
  const judged: JudgeResult[] = [];
  for (const namedAsset of namedAssets) {
    const brief = briefs.find((b) => b.variantId === namedAsset.variantId)!;
    const initial = await runProduce(assetsDir, namedAsset, brief);
    const { produced: finalProduced, judgeResult } = await runJudge(assetsDir, namedAsset, brief, initial);
    produced.push(finalProduced);
    judged.push(judgeResult);
  }

  // ---- 站 7: simulate (只对 still 资产跑三周曲线, motion 不进入媒介曲线) ----
  const simulated: SimulatedCurve[] = [];
  for (const namedAsset of namedAssets.filter((n) => n.format === "still")) {
    const variant = insight.variants.find((v) => v.id === namedAsset.variantId)!;
    simulated.push(runSimulate(namedAsset, variant.angleType, plan.dates.days, waveNumber));
  }

  // ---- 站 8: decide ----
  const decided: Decision[] = simulated.map((curve) => runDecide(curve, plan));

  // ---- 站 9: learn (沉淀赢家特征，供下一波注入) ----
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
    injectedLearnings,
  };

  await writeJSON(path.join(dir, "readout.json"), readout);

  const html = await renderReport(readout);
  await writeFile(path.join(dir, "report.html"), html, "utf-8");

  return readout;
}
