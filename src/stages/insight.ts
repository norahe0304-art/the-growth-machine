/**
 * [INPUT]: depends on lib/openai-client's chatComplete/isMockMode, on types.ts's AngleType/AssetKind/Variant/InsightResult
 * [OUTPUT]: exports runInsight(moment, waveNumber, injectedLearnings) -> InsightResult (3 variants)
 * [POS]: station 1 of the nine-station pipeline, the entry point of the whole flow — a moment gets cracked into 3 asset x newElement variants here
 * [PROTOCOL]: update this header on change, then check CLAUDE.md
 */
import { chatComplete, isMockMode, DEFAULT_MODEL } from "../lib/openai-client.js";
import type { AngleType, AssetKind, InsightResult, Variant } from "../types.js";

// ============================================================
// The formula is fixed in the prompt, not left to the LLM's discretion:
// existing asset x one new element
//   asset has exactly two allowed shapes:
//   1. things people own     — a concrete object the audience already owns and recognizes (a chair / a pair of shoes / a mug)
//   2. interactions people know — a concrete interaction the audience already knows how to do (a handshake / a toast / standing in line)
//   newElement is the one variable that gets swapped/grafted in; everything
//   else must stay recognizable.
// ============================================================
const FORMULA_SYSTEM_PROMPT = `You are the insight-station engine of The Growth Machine. You do exactly one thing:
crack a moment (a news event, a topic, a cultural beat) into 3 creative variants that fit the "existing asset x one new element" formula.

Formula rules:
1. asset must be something the audience already owns or already recognizes. It can only be one of two shapes:
   - "thing": things people own — a concrete object the audience already owns
   - "interaction": interactions people know — a concrete interaction the audience already knows how to do
2. newElement is the single new variable — the one thing that grafts the moment's core tension onto the asset
3. Nothing about the asset itself may be redesigned except for the newElement graft — it must stay fully recognizable
4. angle is a one-sentence description of this variant's hook logic
5. angleType must be exactly one of three values, and it decides which distribution-curve family this variant gets:
   - "moment": trend-riding, attention decays fast
   - "evergreen": doesn't depend on topical heat, settles into steady, durable reach
   - "ugc-loop": a UGC loop — gets reused/remixed wave after wave, compounding
6. workingTitle is a working codename of 5 words or fewer

Output must be strict JSON, in English, in this shape:
{"variants":[{"asset":"...","assetKind":"thing|interaction","newElement":"...","angle":"...","angleType":"moment|evergreen|ugc-loop","workingTitle":"..."}, ...3 total]}
Output nothing outside the JSON.`;

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
    throw new Error("insight: LLM returned an empty variants array");
  }
  return parsed.variants;
}

// ============================================================
// mock branch: deterministic variant generation, keyword-routed by moment.
// A known moment (e.g. "world cup") gets a curated, plausible template pool
// that already reads like real asset x newElement combos. Anything else
// falls back to a generic English template pool. Either way, selection is
// indexed by waveNumber, so the same input always produces the same output
// (the seed IS the determinism, not a metaphor for it).
// If injectedLearnings is present, it's appended to the angle text so a
// diff between wave-01 and wave-02 output visibly shows the carry-forward.
// ============================================================
interface MockTemplate {
  asset: string;
  assetKind: AssetKind;
  newElement: string;
  workingTitle: string;
}

const SLOT_ANGLE_TYPES: AngleType[] = ["moment", "evergreen", "ugc-loop"];

const GENERAL_POOL: Record<AngleType, MockTemplate[]> = {
  moment: [
    { asset: "a water bottle", assetKind: "thing", newElement: "the moment's core tension", workingTitle: "Bottle Beat" },
    { asset: "a shopping receipt", assetKind: "thing", newElement: "the moment's core tension", workingTitle: "Receipt Drop" },
  ],
  evergreen: [
    { asset: "small talk before a meeting", assetKind: "interaction", newElement: "the moment's core tension", workingTitle: "Meeting Beat" },
    { asset: "waiting in line for coffee", assetKind: "interaction", newElement: "the moment's core tension", workingTitle: "Line Beat" },
  ],
  "ugc-loop": [
    { asset: "a pair of slippers", assetKind: "thing", newElement: "the moment's core tension", workingTitle: "Slipper Loop" },
    { asset: "scrolling past an ad", assetKind: "interaction", newElement: "the moment's core tension", workingTitle: "Scroll Loop" },
  ],
};

const WORLD_CUP_POOL: Record<AngleType, MockTemplate[]> = {
  moment: [
    { asset: "your selfie", assetKind: "thing", newElement: "final night stands", workingTitle: "Selfie Final" },
    { asset: "your watch-party outfit", assetKind: "thing", newElement: "final night stands", workingTitle: "Outfit Final" },
  ],
  evergreen: [
    { asset: "friend group photo", assetKind: "thing", newElement: "team poster style", workingTitle: "Team Poster" },
    { asset: "your profile picture", assetKind: "thing", newElement: "team poster style", workingTitle: "Profile Poster" },
  ],
  "ugc-loop": [
    { asset: "your chat highlights", assetKind: "interaction", newElement: "match commentary", workingTitle: "Chat Commentary" },
    { asset: "your group chat reactions", assetKind: "interaction", newElement: "match commentary", workingTitle: "Reaction Commentary" },
  ],
};

function keywordPoolFor(moment: string): Record<AngleType, MockTemplate[]> {
  const lower = moment.toLowerCase();
  if (lower.includes("world cup")) return WORLD_CUP_POOL;
  return GENERAL_POOL;
}

function mockVariants(moment: string, waveNumber: number, injectedLearnings: string | null): RawVariant[] {
  const pool = keywordPoolFor(moment);
  const traitSuffix = injectedLearnings ? `, carrying forward last wave's winning traits [${injectedLearnings}]` : "";
  return SLOT_ANGLE_TYPES.map((angleType) => {
    const options = pool[angleType];
    const tmpl = options[(waveNumber - 1) % options.length];
    return {
      asset: tmpl.asset,
      assetKind: tmpl.assetKind,
      newElement: tmpl.newElement,
      angle: `graft "${moment}" onto "${tmpl.asset}"${traitSuffix}`,
      angleType,
      workingTitle: tmpl.workingTitle,
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
    ? `\n\nWinning traits from the previous wave (extend these while keeping the formula rules intact — this is where real evolution happens):\n${injectedLearnings}`
    : "";
  const userPrompt = `moment: "${moment}"\nwave ${waveNumber}.${learningsBlock}\nProduce 3 variants.`;

  const raw = await chatComplete({
    system: FORMULA_SYSTEM_PROMPT,
    user: userPrompt,
    model: DEFAULT_MODEL,
  });
  const variants = normalizeVariants(parseJSONResponse(raw));
  return { moment, waveNumber, variants };
}
