/**
 * [INPUT]: depends on src/types.ts's AssetKind / AngleType
 * [OUTPUT]: exports the nine-segment naming dictionaries —— CHANNEL/OBJ/FUNNEL/TEMP/FORMAT lookup tables + slug utilities
 * [POS]: the sole data source for naming.ts; the dictionary shares the book's decoder-ring style (all-caps abbreviations joined by underscores)
 * [PROTOCOL]: update this header on change, then check CLAUDE.md
 */
import type { AngleType, AssetKind } from "./types.js";

// ============================================================
// Nine-segment name: CHANNEL_OBJ_FUNNEL_TEMP_FORMAT_HOOK_MOMENT_PERSONA_VER
// First five segments are dictionary lookups (deterministic); last four
// are deterministic slugs derived from the input text (no LLM).
// ============================================================

// 1. CHANNEL — media channel; the machine doesn't know the real channel yet, so WEB stands for "cross-channel, not yet assigned"
export const CHANNEL = "WEB" as const;

// 2. OBJ — objective, decided by assetKind: thing assets skew conversion, interaction assets skew engagement
export const OBJ_BY_ASSET_KIND: Record<AssetKind, string> = {
  thing: "CONV",
  interaction: "ENGT",
};

// 3. FUNNEL — funnel stage, decided by angleType
export const FUNNEL_BY_ANGLE_TYPE: Record<AngleType, string> = {
  moment: "TOF",
  evergreen: "MOF",
  "ugc-loop": "BOF",
};

// 4. TEMP — temperature/angle family, maps 1:1 to angleType
export const TEMP_BY_ANGLE_TYPE: Record<AngleType, string> = {
  moment: "HOT",
  evergreen: "EVG",
  "ugc-loop": "LOOP",
};

// 5. FORMAT — delivery format
export const FORMAT_CODE: Record<"still" | "motion", string> = {
  still: "STIL",
  motion: "MOTN",
};

// ============================================================
// slug utility: compresses arbitrary natural language into a
// deterministic, all-caps short code.
// rule: strip non-alphanumerics -> uppercase -> truncate to maxLen,
// or right-pad with X if too short.
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

// 6. HOOK — derived from angle, 4 chars
export function hookCode(angle: string): string {
  return slugCode(angle, 4);
}

// 7. MOMENT — derived from the moment text, 6 chars
export function momentCode(moment: string): string {
  return slugCode(moment, 6);
}

// 8. PERSONA — derived from audience, 4 chars
export function personaCode(audience: string): string {
  return slugCode(audience, 4);
}

// 9. VER — version number, zero-padded to two digits
export function verCode(version: number): string {
  return `V${String(version).padStart(2, "0")}`;
}
