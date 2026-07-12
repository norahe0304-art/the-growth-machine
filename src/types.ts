/**
 * [INPUT]: 无依赖，纯类型定义
 * [OUTPUT]: 对外提供贯穿六站流水线的共享类型 —— Variant / Brief / NamedAsset / Plan / ProducedAsset / JudgeResult / SimulatedCurve / Decision / LearningEntry
 * [POS]: src/ 的类型根，所有 stages/*.ts 与 lib/*.ts 从此导入，是流水线各站之间的契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

// ============================================================
// 公式原语：existing asset x one new element
// asset 两种形态：things people own(物) / interactions people know(互动)
// ============================================================
export type AssetKind = "thing" | "interaction";

// 角度类型决定 simulate 阶段选用哪种响应模型
export type AngleType = "moment" | "evergreen" | "ugc-loop";

export interface Variant {
  id: string; // v1, v2, v3
  asset: string; // existing asset 的具体描述
  assetKind: AssetKind;
  newElement: string; // one new element
  angle: string; // 角度的自然语言描述
  angleType: AngleType; // 决定 simulate 响应曲线族
  workingTitle: string;
}

export interface InsightResult {
  moment: string;
  waveNumber: number;
  variants: Variant[];
}

// ============================================================
// Brief：一页交付物，generationPrompts 是一等公民
// ============================================================
export interface GenerationPrompts {
  image: string; // 拿去就能用的 Images API prompt
  motion: string; // 标注 for ChatCut 的动态脚本 prompt
  copy: string; // 文案生成 prompt
}

export interface Brief {
  variantId: string;
  workingTitle: string;
  audience: string;
  insight: string;
  assetXElement: string; // "asset x newElement" 公式化描述
  formats: Array<"still" | "motion">;
  successMetric: string;
  generationPrompts: GenerationPrompts;
}

// ============================================================
// Naming：九段命名，无 LLM，确定性函数
// ============================================================
export interface NamingInput {
  variant: Variant;
  format: "still" | "motion";
  moment: string;
  audience: string;
  version: number;
}

export interface NamedAsset {
  variantId: string;
  format: "still" | "motion";
  name: string; // CHANNEL_OBJ_FUNNEL_TEMP_FORMAT_HOOK_MOMENT_PERSONA_VER
  segments: Record<string, string>;
}

// ============================================================
// Plan：测试计划，规则 + LLM 混合
// ============================================================
export interface PreRegisteredThresholds {
  scaleAt: number; // CTR 达到此值 -> SCALE
  killAt: number; // CTR 低于此值 -> KILL
  fatigueSlope: number; // 曲线斜率低于此值(负值越小越疲劳) -> KILL 信号
}

export interface PlanArm {
  variantId: string;
  format: "still" | "motion";
  name: string;
  trafficSplitPct: number;
  budgetIllustrative: number; // 纯示意，非真实媒介预算
}

export interface Plan {
  moment: string;
  waveNumber: number;
  arms: PlanArm[];
  preRegisteredThresholds: Record<AngleType, PreRegisteredThresholds>;
  dates: { start: string; end: string; days: number };
  rationale: string; // LLM 生成的一句计划逻辑
}

// ============================================================
// Produce：真生成交付物
// ============================================================
export interface ProducedAsset {
  variantId: string;
  format: "still" | "motion";
  name: string;
  assetPath: string | null; // still: png/svg 路径；motion: null(不真渲染)
  copy: string;
  motionScript: string[] | null; // motion: 分镜三行
  imageModelUsed: string | null;
  regeneratedCount: number;
}

// ============================================================
// Judge：三分制自检
// ============================================================
export interface JudgeScore {
  onBrief: 1 | 2 | 3;
  legible: 1 | 2 | 3;
  shareable: 1 | 2 | 3;
}

export interface JudgeResult {
  variantId: string;
  format: "still" | "motion";
  score: JudgeScore;
  passed: boolean; // 任一维度 == 1 视为 fail
  regenerated: boolean;
  notes: string;
}

// ============================================================
// Simulate：三周日级曲线
// ============================================================
export interface SimulatedCurve {
  variantId: string;
  format: "still" | "motion";
  angleType: AngleType;
  days: number;
  predictedCTR: number[]; // 长度 = days
  shareRate: number[]; // 长度 = days
  seed: string;
}

// ============================================================
// Decide：SCALE / KILL / ITERATE
// ============================================================
export type Verdict = "SCALE" | "KILL" | "ITERATE";

export interface Decision {
  variantId: string;
  format: "still" | "motion";
  verdict: Verdict;
  reason: string; // 一句机器理由
  finalCTR: number;
  slope: number;
}

// ============================================================
// Learn：跨波进化
// ============================================================
export interface LearningEntry {
  wave: number;
  moment: string;
  timestamp: string;
  winners: string[]; // 资产名列表(SCALE 判决)
  traits: string[]; // 从赢家提炼的可复用特征
  learnings: string; // 一段给下一波 prompt 用的注入文本
}

// ============================================================
// Wave：一波完整产出的汇总视图，供 report.ts 消费
// ============================================================
export interface WaveReadout {
  moment: string;
  waveNumber: number;
  variants: Variant[];
  briefs: Brief[];
  namedAssets: NamedAsset[];
  plan: Plan;
  produced: ProducedAsset[];
  judged: JudgeResult[];
  simulated: SimulatedCurve[];
  decided: Decision[];
  injectedLearnings: string | null; // 上一波注入的学习(若有)
}
