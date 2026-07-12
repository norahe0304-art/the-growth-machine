/**
 * [INPUT]: 依赖 lib/fs-utils 的 appendJSONL/readJSONL/LIBRARY_PATH，依赖 types.ts 的 LearningEntry/Decision/Variant/NamedAsset
 * [OUTPUT]: 对外提供 runLearn(...) -> LearningEntry(追加进 library.jsonl) / getInjectedLearnings() -> string|null
 * [POS]: 六站流水线第 9 站，是"真进化"发生的地方 —— 把这一波的赢家特征沉淀，供下一波 insight/brief 注入
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { appendJSONL, readJSONL, LIBRARY_PATH } from "../lib/fs-utils.js";
import type { Decision, LearningEntry, NamedAsset, Variant } from "../types.js";

function extractTraits(winners: Decision[], variants: Variant[], namedAssets: NamedAsset[]): string[] {
  const traits: string[] = [];
  for (const win of winners) {
    const na = namedAssets.find((n) => n.variantId === win.variantId && n.format === win.format);
    const variant = variants.find((v) => v.id === win.variantId);
    if (!variant || !na) continue;
    traits.push(`${variant.assetKind}型资产「${variant.asset}」+ angleType=${variant.angleType} + HOOK=${na.segments.HOOK}`);
  }
  return traits;
}

export async function runLearn(
  waveNumber: number,
  moment: string,
  variants: Variant[],
  namedAssets: NamedAsset[],
  decisions: Decision[]
): Promise<LearningEntry> {
  const winnerDecisions = decisions.filter((d) => d.verdict === "SCALE");
  const winners = winnerDecisions.map((d) => {
    const na = namedAssets.find((n) => n.variantId === d.variantId && n.format === d.format);
    return na?.name ?? `${d.variantId}_${d.format}`;
  });
  const traits = extractTraits(winnerDecisions, variants, namedAssets);

  const learnings =
    traits.length > 0
      ? `上一波(wave ${waveNumber})的赢家特征: ${traits.join("; ")}。优先在新变体中复用这些 asset 形态与 angleType 组合。`
      : `上一波(wave ${waveNumber})没有 SCALE 判决，下一波应尝试更贴近受众已知语境的 asset，避免重复失败角度。`;

  const entry: LearningEntry = {
    wave: waveNumber,
    moment,
    timestamp: new Date().toISOString(),
    winners,
    traits,
    learnings,
  };

  await appendJSONL(LIBRARY_PATH, entry);
  return entry;
}

// 供 insight/brief 站在下一波开跑前读取：取 library.jsonl 最后一条的 learnings 文本
export async function getInjectedLearnings(): Promise<string | null> {
  const entries = await readJSONL<LearningEntry>(LIBRARY_PATH);
  if (entries.length === 0) return null;
  return entries[entries.length - 1].learnings;
}

// next 命令用：从 library.jsonl 还原上一次跑的 moment 与最新 wave 序号
export async function getLastRunState(): Promise<{ moment: string; lastWave: number } | null> {
  const entries = await readJSONL<LearningEntry>(LIBRARY_PATH);
  if (entries.length === 0) return null;
  const last = entries[entries.length - 1];
  return { moment: last.moment, lastWave: last.wave };
}
