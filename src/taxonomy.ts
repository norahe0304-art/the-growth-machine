/**
 * [INPUT]: 依赖 src/types.ts 的 AssetKind / AngleType
 * [OUTPUT]: 对外提供九段命名字典常量 —— CHANNEL/OBJ/FUNNEL/TEMP/FORMAT 的枚举表 + slugify 工具
 * [POS]: naming.ts 的唯一数据源，字典与书的解码器风格同族(全大写缩写 + 下划线分隔)
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { AngleType, AssetKind } from "./types.js";

// ============================================================
// 九段命名: CHANNEL_OBJ_FUNNEL_TEMP_FORMAT_HOOK_MOMENT_PERSONA_VER
// 前五段查字典(确定性)，后四段由输入文本派生(确定性 slug，无 LLM)
// ============================================================

// 1. CHANNEL — 投放渠道，机器不知道具体投放渠道，固定用 WEB 代表"跨渠道待分发"
export const CHANNEL = "WEB" as const;

// 2. OBJ — 目标，由 assetKind 决定：物件资产偏 conversion，互动资产偏 engagement
export const OBJ_BY_ASSET_KIND: Record<AssetKind, string> = {
  thing: "CONV",
  interaction: "ENGT",
};

// 3. FUNNEL — 漏斗层级，由 angleType 决定
export const FUNNEL_BY_ANGLE_TYPE: Record<AngleType, string> = {
  moment: "TOF",
  evergreen: "MOF",
  "ugc-loop": "BOF",
};

// 4. TEMP — 温度/角度族，与 angleType 一一对应
export const TEMP_BY_ANGLE_TYPE: Record<AngleType, string> = {
  moment: "HOT",
  evergreen: "EVG",
  "ugc-loop": "LOOP",
};

// 5. FORMAT — 交付格式
export const FORMAT_CODE: Record<"still" | "motion", string> = {
  still: "STIL",
  motion: "MOTN",
};

// ============================================================
// slug 工具：把任意自然语言压成确定性的全大写短代码
// 规则：去掉非字母数字 → 大写 → 截断到 maxLen → 不足时右填 X
// ============================================================
export function slugCode(input: string, maxLen: number): string {
  const cleaned = input
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
  if (cleaned.length === 0) return "X".repeat(maxLen);
  if (cleaned.length >= maxLen) return cleaned.slice(0, maxLen);
  return cleaned.padEnd(maxLen, "X");
}

// 6. HOOK — 从 angle 派生，4 位
export function hookCode(angle: string): string {
  return slugCode(angle, 4);
}

// 7. MOMENT — 从 moment 文本派生，6 位
export function momentCode(moment: string): string {
  return slugCode(moment, 6);
}

// 8. PERSONA — 从 audience 派生，4 位
export function personaCode(audience: string): string {
  return slugCode(audience, 4);
}

// 9. VER — 版本号，两位数字补零
export function verCode(version: number): string {
  return `V${String(version).padStart(2, "0")}`;
}
