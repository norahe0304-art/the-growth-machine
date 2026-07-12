/**
 * [INPUT]: depends on src/taxonomy.ts's nine-segment dictionaries and slug utilities, on types.ts's NamingInput/NamedAsset
 * [OUTPUT]: exports runNaming(input) -> NamedAsset, a deterministic nine-segment name, no LLM involved
 * [POS]: station 3 of the nine-station pipeline, the only station that never calls a model — same input, always the same output
 * [PROTOCOL]: update this header on change, then check CLAUDE.md
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
