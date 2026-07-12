/**
 * [INPUT]: 依赖 lib/openai-client 的 chatComplete/isMockMode，依赖 types.ts 的 Variant/InsightResult
 * [OUTPUT]: 对外提供 runInsight(moment, waveNumber, injectedLearnings) -> InsightResult(3 个变体)
 * [POS]: 六站流水线第 1 站，是全流程的入口 —— moment 文本在此被拆解成 3 个 asset x newElement 变体
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { chatComplete, isMockMode, DEFAULT_MODEL } from "../lib/openai-client.js";
import type { AngleType, AssetKind, InsightResult, Variant } from "../types.js";

// ============================================================
// 公式定义 —— 写死在 prompt 里，不允许 LLM 自由发挥
// existing asset x one new element
//   asset 有且只有两种形态：
//   1. things people own   —— 人已经拥有、认得出的物件(一把椅子/一双鞋/一个杯子)
//   2. interactions people know —— 人已经会做、认得出的互动动作(握手/碰杯/排队)
//   newElement 是唯一被替换/嫁接的新变量，其余部分必须保持"眼熟"
// ============================================================
const FORMULA_SYSTEM_PROMPT = `你是 The Growth Machine 的 insight 站引擎，只做一件事：
把一个 moment(时事/话题/节点)拆解成 3 个符合"existing asset x one new element"公式的创意变体。

公式铁律：
1. asset 必须是受众"已经拥有或已经认得"的东西，只能是以下两种形态之一：
   - "thing"：things people own —— 一个具体的、人已拥有的物件
   - "interaction"：interactions people know —— 一个具体的、人已会做的互动动作
2. newElement 是唯一的新变量 —— 把 moment 的核心张力嫁接到 asset 上的那一个新东西
3. 除 newElement 外，asset 本身必须保持完全眼熟，不能连 asset 一起改造
4. angle 是一句话描述这个变体的钩子逻辑
5. angleType 必须是三选一，决定这个变体的传播曲线族：
   - "moment"：话题型，蹭热点，注意力会快速衰减
   - "evergreen"：长青型，不依赖话题热度，稳定沉淀
   - "ugc-loop"：UGC 循环型，每一波会被复用/二创，越滚越大
6. workingTitle 是 5 个字以内的工作代号

输出严格 JSON，格式：
{"variants":[{"asset":"...","assetKind":"thing|interaction","newElement":"...","angle":"...","angleType":"moment|evergreen|ugc-loop","workingTitle":"..."}, ...3个]}
不要输出任何 JSON 之外的文字。`;

interface RawVariant {
  asset: string;
  assetKind: string;
  newElement: string;
  angle: string;
  angleType: string;
  workingTitle: string;
}

function coerceAssetKind(v: string): AssetKind {
  return v === "interaction" ? "interaction" : "thing";
}

function coerceAngleType(v: string): AngleType {
  if (v === "evergreen" || v === "ugc-loop") return v;
  return "moment";
}

function normalizeVariants(raw: RawVariant[]): Variant[] {
  return raw.slice(0, 3).map((r, i) => ({
    id: `v${i + 1}`,
    asset: r.asset,
    assetKind: coerceAssetKind(r.assetKind),
    newElement: r.newElement,
    angle: r.angle,
    angleType: coerceAngleType(r.angleType),
    workingTitle: r.workingTitle,
  }));
}

function parseJSONResponse(text: string): RawVariant[] {
  const match = text.match(/\{[\s\S]*\}/);
  const jsonText = match ? match[0] : text;
  const parsed = JSON.parse(jsonText) as { variants: RawVariant[] };
  if (!Array.isArray(parsed.variants) || parsed.variants.length < 1) {
    throw new Error("insight: LLM 返回的 variants 为空");
  }
  return parsed.variants;
}

// ============================================================
// mock 分支：确定性生成 3 个变体，若有 injectedLearnings 则把上波赢家特征
// 显式拼进 angle，方便端到端自证(grep 可见 wave-02 continue 了 wave-01 的赢家特征)
// ============================================================
const MOCK_THING_POOL = ["一个保温杯", "一副耳机", "一张购物小票", "一双拖鞋"];
const MOCK_INTERACTION_POOL = ["排队等咖啡", "开会前的寒暄", "刷到广告时的划走", "结账时的扫码"];

function mockVariants(moment: string, waveNumber: number, injectedLearnings: string | null): RawVariant[] {
  const traitSuffix = injectedLearnings ? ` + 延续上波赢家特征[${injectedLearnings}]` : "";
  const kinds: AssetKind[] = ["thing", "interaction", "thing"];
  const angleTypes: AngleType[] = ["moment", "evergreen", "ugc-loop"];
  return kinds.map((kind, i) => {
    const pool = kind === "thing" ? MOCK_THING_POOL : MOCK_INTERACTION_POOL;
    const asset = pool[(waveNumber - 1 + i) % pool.length];
    return {
      asset,
      assetKind: kind,
      newElement: `${moment} 的核心张力`,
      angle: `把「${moment}」嫁接到「${asset}」上${traitSuffix}`,
      angleType: angleTypes[i],
      workingTitle: `W${waveNumber}变体${i + 1}`,
    };
  });
}

export async function runInsight(
  moment: string,
  waveNumber: number,
  injectedLearnings: string | null
): Promise<InsightResult> {
  if (isMockMode()) {
    return { moment, waveNumber, variants: normalizeVariants(mockVariants(moment, waveNumber, injectedLearnings)) };
  }

  const learningsBlock = injectedLearnings
    ? `\n\n上一波的赢家特征(请在保持公式铁律的前提下延续这些特征，实现真进化)：\n${injectedLearnings}`
    : "";
  const userPrompt = `moment: "${moment}"\n第 ${waveNumber} 波。${learningsBlock}\n请产出 3 个变体。`;

  const raw = await chatComplete({
    system: FORMULA_SYSTEM_PROMPT,
    user: userPrompt,
    model: DEFAULT_MODEL,
  });
  const variants = normalizeVariants(parseJSONResponse(raw));
  return { moment, waveNumber, variants };
}
