/**
 * [INPUT]: 依赖 lib/openai-client 的 chatComplete/isMockMode，依赖 types.ts 的 Plan/PlanArm/NamedAsset/Brief
 * [OUTPUT]: 对外提供 runPlan(...) -> Plan，PRE_REGISTERED_THRESHOLDS 常量表(阈值预注册)
 * [POS]: 六站流水线第 4 站，规则决定阈值与流量分配，LLM 只负责一句 rationale
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { chatComplete, isMockMode, DEFAULT_MODEL } from "../lib/openai-client.js";
import type { AngleType, NamedAsset, Plan, PlanArm, PreRegisteredThresholds, Variant } from "../types.js";

// ============================================================
// 预注册阈值常量表 —— 写死，不允许运行时篡改，这是"预注册"的意义所在
// scaleAt/killAt 是 CTR(0-1)，fatigueSlope 是曲线末段斜率阈值(越负越疲劳)
// 三种角度类型的阈值不同：moment 型见顶快、容忍疲劳；evergreen 型要求稳；
// ugc-loop 型给最长的观察窗与最高的 scale 门槛(因为它要滚雪球)
// ============================================================
export const PRE_REGISTERED_THRESHOLDS: Record<AngleType, PreRegisteredThresholds> = {
  moment: { scaleAt: 0.045, killAt: 0.015, fatigueSlope: -0.004 },
  evergreen: { scaleAt: 0.035, killAt: 0.012, fatigueSlope: -0.0015 },
  "ugc-loop": { scaleAt: 0.05, killAt: 0.018, fatigueSlope: -0.002 },
};

const OBSERVATION_WINDOW_DAYS = 21; // 三周日级曲线，固定窗口

function budgetFor(angleType: AngleType): number {
  // 示意预算，非真实媒介预算：moment 型集中花，evergreen/ugc-loop 型摊薄
  if (angleType === "moment") return 500;
  if (angleType === "ugc-loop") return 350;
  return 250;
}

function trafficSplitFor(arms: number): number {
  return Math.round((100 / arms) * 100) / 100;
}

const PLAN_SYSTEM_PROMPT = `你是 The Growth Machine 的 plan 站引擎。
阈值和流量分配已经由规则算好，你只需要用一句话说明这版测试计划的逻辑(为什么这样分流量、为什么这个观察窗)。
输出严格 JSON：{"rationale":"..."}
不要输出任何 JSON 之外的文字。`;

function mockRationale(moment: string, waveNumber: number): string {
  return `第 ${waveNumber} 波围绕「${moment}」等量分流三个变体，21 天观察窗覆盖疲劳曲线的完整拐点`;
}

export async function runPlan(
  moment: string,
  waveNumber: number,
  variants: Variant[],
  namedAssets: NamedAsset[]
): Promise<Plan> {
  const stillAssets = namedAssets.filter((n) => n.format === "still");
  const armCount = stillAssets.length;
  const splitPct = trafficSplitFor(armCount);

  const arms: PlanArm[] = stillAssets.map((na) => {
    const variant = variants.find((v) => v.id === na.variantId)!;
    return {
      variantId: na.variantId,
      format: na.format,
      name: na.name,
      trafficSplitPct: splitPct,
      budgetIllustrative: budgetFor(variant.angleType),
    };
  });

  const start = new Date();
  const end = new Date(start.getTime() + OBSERVATION_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const rationale = isMockMode()
    ? mockRationale(moment, waveNumber)
    : await chatComplete({
        system: PLAN_SYSTEM_PROMPT,
        user: `moment: "${moment}"\n第 ${waveNumber} 波\narms: ${JSON.stringify(arms)}`,
        model: DEFAULT_MODEL,
      }).then((raw) => {
        try {
          const match = raw.match(/\{[\s\S]*\}/);
          const parsed = JSON.parse(match ? match[0] : raw) as { rationale: string };
          return parsed.rationale;
        } catch {
          return raw.trim();
        }
      });

  return {
    moment,
    waveNumber,
    arms,
    preRegisteredThresholds: PRE_REGISTERED_THRESHOLDS,
    dates: {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
      days: OBSERVATION_WINDOW_DAYS,
    },
    rationale,
  };
}
