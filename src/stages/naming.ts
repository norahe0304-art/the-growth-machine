/**
 * [INPUT]: 依赖 src/taxonomy.ts 的九段字典与 slug 工具，依赖 types.ts 的 NamingInput/NamedAsset
 * [OUTPUT]: 对外提供 runNaming(input) -> NamedAsset，确定性九段命名，无 LLM 参与
 * [POS]: 六站流水线第 3 站，唯一不调用模型的站 —— 同输入永远同输出
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import {
  CHANNEL,
  OBJ_BY_ASSET_KIND,
  FUNNEL_BY_ANGLE_TYPE,
  TEMP_BY_ANGLE_TYPE,
  FORMAT_CODE,
  hookCode,
  momentCode,
  personaCode,
  verCode,
} from "../taxonomy.js";
import type { NamedAsset, NamingInput } from "../types.js";

export function runNaming(input: NamingInput): NamedAsset {
  const { variant, format, moment, audience, version } = input;

  const segments: Record<string, string> = {
    CHANNEL,
    OBJ: OBJ_BY_ASSET_KIND[variant.assetKind],
    FUNNEL: FUNNEL_BY_ANGLE_TYPE[variant.angleType],
    TEMP: TEMP_BY_ANGLE_TYPE[variant.angleType],
    FORMAT: FORMAT_CODE[format],
    HOOK: hookCode(variant.angle),
    MOMENT: momentCode(moment),
    PERSONA: personaCode(audience),
    VER: verCode(version),
  };

  const name = [
    segments.CHANNEL,
    segments.OBJ,
    segments.FUNNEL,
    segments.TEMP,
    segments.FORMAT,
    segments.HOOK,
    segments.MOMENT,
    segments.PERSONA,
    segments.VER,
  ].join("_");

  return { variantId: variant.id, format, name, segments };
}
