/**
 * [INPUT]: 依赖 lib/openai-client 的 chatComplete/isMockMode，依赖 lib/hash 的 hashString/mulberry32，依赖 stages/produce.ts 的 runProduce
 * [OUTPUT]: 对外提供 runJudge(...) -> { produced, judgeResult }，三分制自检 + 失败自动重生成一次
 * [POS]: 六站流水线第 6 站，是 produce 与 simulate 之间的质检闸门 —— 任一维度 fail(=1) 触发最多一次重生成
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { chatComplete, isMockMode, DEFAULT_MODEL } from "../lib/openai-client.js";
import { hashString, mulberry32 } from "../lib/hash.js";
import { runProduce } from "./produce.js";
import type { Brief, JudgeResult, JudgeScore, NamedAsset, ProducedAsset } from "../types.js";

const JUDGE_SYSTEM_PROMPT = `你是 The Growth Machine 的 judge 站引擎，一个严格的资产裁判。
根据 brief 与实际产出的文案/生图 prompt/分镜，对资产打三分制分：
1 = 不合格(fail) 2 = 合格 3 = 优秀
三个维度：
- onBrief: 是否忠实执行了 brief 的 assetXElement 与 insight
- legible: 受众能否在1秒内看懂在说什么
- shareable: 受众是否有转发/二创的冲动

输出严格 JSON：{"onBrief":1|2|3,"legible":1|2|3,"shareable":1|2|3,"notes":"..."}
不要输出任何 JSON 之外的文字。`;

function isFail(score: JudgeScore): boolean {
  return score.onBrief === 1 || score.legible === 1 || score.shareable === 1;
}

function mockDimension(rng: () => number): 1 | 2 | 3 {
  const r = rng();
  if (r < 0.12) return 1;
  if (r < 0.55) return 2;
  return 3;
}

function mockScore(name: string, attempt: number): JudgeScore {
  const seed = hashString(`${name}#attempt${attempt}`);
  const rng = mulberry32(seed);
  return { onBrief: mockDimension(rng), legible: mockDimension(rng), shareable: mockDimension(rng) };
}

async function scoreAsset(produced: ProducedAsset, brief: Brief, attempt: number): Promise<{ score: JudgeScore; notes: string }> {
  if (isMockMode()) {
    return { score: mockScore(produced.name, attempt), notes: `[mock judge] attempt ${attempt}` };
  }
  const raw = await chatComplete({
    system: JUDGE_SYSTEM_PROMPT,
    user: `brief: ${JSON.stringify(brief)}\nproduced: ${JSON.stringify({ copy: produced.copy, motionScript: produced.motionScript, name: produced.name })}`,
    model: DEFAULT_MODEL,
  });
  const match = raw.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(match ? match[0] : raw) as JudgeScore & { notes: string };
  return { score: { onBrief: parsed.onBrief, legible: parsed.legible, shareable: parsed.shareable }, notes: parsed.notes ?? "" };
}

export async function runJudge(
  assetsDir: string,
  namedAsset: NamedAsset,
  brief: Brief,
  initialProduced: ProducedAsset
): Promise<{ produced: ProducedAsset; judgeResult: JudgeResult }> {
  let produced = initialProduced;
  let attempt = 1;
  let { score, notes } = await scoreAsset(produced, brief, attempt);

  if (isFail(score) && attempt === 1) {
    // 最多重生成一次
    produced = await runProduce(assetsDir, namedAsset, brief);
    produced.regeneratedCount = 1;
    attempt = 2;
    ({ score, notes } = await scoreAsset(produced, brief, attempt));
  }

  const judgeResult: JudgeResult = {
    variantId: namedAsset.variantId,
    format: namedAsset.format,
    score,
    passed: !isFail(score),
    regenerated: attempt === 2,
    notes,
  };

  return { produced, judgeResult };
}
