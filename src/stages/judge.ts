/**
 * [INPUT]: depends on lib/openai-client's chatComplete/isMockMode, on lib/hash's hashString/mulberry32, on stages/produce.ts's runProduce
 * [OUTPUT]: exports runJudge(...) -> { produced, judgeResult }, three-point self-check with one automatic regeneration on failure
 * [POS]: station 6 of the nine-station pipeline, the quality gate between produce and simulate — any dimension scoring fail(=1) triggers up to one regeneration
 * [PROTOCOL]: update this header on change, then check CLAUDE.md
 */
import { chatComplete, isMockMode, DEFAULT_MODEL } from "../lib/openai-client.js";
import { hashString, mulberry32 } from "../lib/hash.js";
import { runProduce } from "./produce.js";
import type { Brief, JudgeResult, JudgeScore, NamedAsset, ProducedAsset } from "../types.js";

const JUDGE_SYSTEM_PROMPT = `You are the judge-station engine of The Growth Machine, a strict asset referee.
Given the brief and the actual produced copy / image prompt / storyboard, score the asset on a 3-point scale:
1 = fail   2 = pass   3 = excellent
Three dimensions:
- onBrief: did it faithfully execute the brief's assetXElement and insight
- legible: can the audience understand what's happening within one second
- shareable: does the audience feel an urge to share/remix it

Output must be strict JSON, in English: {"onBrief":1|2|3,"legible":1|2|3,"shareable":1|2|3,"notes":"..."}
Output nothing outside the JSON.`;

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
    // at most one regeneration
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
