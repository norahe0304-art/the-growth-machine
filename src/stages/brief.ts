/**
 * [INPUT]: 依赖 lib/openai-client 的 chatComplete/isMockMode，依赖 types.ts 的 Variant/Brief
 * [OUTPUT]: 对外提供 runBrief(variant, moment) -> Brief，其中 generationPrompts 是一等公民交付物
 * [POS]: 六站流水线第 2 站，把 insight 的变体压成一页可执行 brief，直接喂给 produce 站
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { chatComplete, isMockMode, DEFAULT_MODEL } from "../lib/openai-client.js";
import type { Brief, Variant } from "../types.js";

const BRIEF_SYSTEM_PROMPT = `你是 The Growth Machine 的 brief 站引擎。
输入是一个已经符合"existing asset x one new element"公式的创意变体，你要把它压成一页可执行 brief。

generationPrompts 是本站最重要的交付物 —— 必须是"拿去就能直接跑"的完整 prompt，不是摘要，不是提纲：
- image: 完整的 Images API 生图 prompt，包含构图/光线/风格/主体细节
- motion: 完整的动态脚本 prompt，明确标注"for ChatCut"，说明分镜逻辑
- copy: 完整的文案生成 prompt，说明语气/长度/要点

输出严格 JSON：
{"audience":"...","insight":"...","assetXelement":"...","successMetric":"...","generationPrompts":{"image":"...","motion":"...","copy":"..."}}
不要输出任何 JSON 之外的文字。`;

interface RawBrief {
  audience: string;
  insight: string;
  assetXelement: string;
  successMetric: string;
  generationPrompts: { image: string; motion: string; copy: string };
}

function parseJSONResponse(text: string): RawBrief {
  const match = text.match(/\{[\s\S]*\}/);
  const jsonText = match ? match[0] : text;
  return JSON.parse(jsonText) as RawBrief;
}

function mockBrief(variant: Variant, moment: string): RawBrief {
  const assetXelement = `${variant.asset} x ${variant.newElement}`;
  return {
    audience: `关注「${moment}」的年轻受众`,
    insight: `受众对「${variant.asset}」眼熟到会自动忽略，但「${variant.newElement}」能让他们停下来多看一眼`,
    assetXelement,
    successMetric: variant.angleType === "moment" ? "48小时内分享率" : "7日留存曝光",
    generationPrompts: {
      image: `画面主体是${variant.asset}，在其上嫁接${variant.newElement}的视觉细节，风格：编辑级摄影，浅景深，构图居中留白，光线自然，16:9`,
      motion: `[for ChatCut] 三镜头脚本：镜头1建立${variant.asset}的日常语境；镜头2引入${variant.newElement}制造反差；镜头3给出钩子文案落版，时长6秒`,
      copy: `写一句不超过20字的钩子文案，围绕"${variant.angle}"，语气克制不喧哗，禁用感叹号`,
    },
  };
}

export async function runBrief(variant: Variant, moment: string): Promise<Brief> {
  const raw = isMockMode()
    ? mockBrief(variant, moment)
    : parseJSONResponse(
        await chatComplete({
          system: BRIEF_SYSTEM_PROMPT,
          user: `moment: "${moment}"\n变体: ${JSON.stringify(variant)}`,
          model: DEFAULT_MODEL,
        })
      );

  return {
    variantId: variant.id,
    workingTitle: variant.workingTitle,
    audience: raw.audience,
    insight: raw.insight,
    assetXElement: raw.assetXelement,
    formats: ["still", "motion"],
    successMetric: raw.successMetric,
    generationPrompts: raw.generationPrompts,
  };
}
