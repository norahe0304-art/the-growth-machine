/**
 * [INPUT]: depends on lib/openai-client's chatComplete/isMockMode, on lib/hash's hashString/mulberry32, on lib/fs-utils's fileExists, on node:fs/promises's readFile, on node:path, on stages/produce.ts's runProduce
 * [OUTPUT]: exports runJudge(...) -> { produced, judgeResult }, four-point self-check (onBrief/legible/shareable/brandFit) with one automatic regeneration on failure
 * [POS]: station 6 of the ten-station pipeline, the quality gate between produce and simulate: any dimension scoring fail(=1) triggers up to one regeneration
 * [PROTOCOL]: update this header on change, then check CLAUDE.md
 */
import path from "node:path";
import { readFile } from "node:fs/promises";
import { chatComplete, isMockMode, DEFAULT_MODEL } from "../lib/openai-client.js";
import { hashString, mulberry32 } from "../lib/hash.js";
import { fileExists } from "../lib/fs-utils.js";
import { runProduce } from "./produce.js";
import type { Brief, JudgeResult, JudgeScore, NamedAsset, ProducedAsset } from "../types.js";

const JUDGE_BASE_PROMPT = `You are the judge-station engine of The Growth Machine, a strict asset referee.
Given the brief and the actual produced copy / image prompt / storyboard, score the asset on a 3-point scale:
1 = fail   2 = pass   3 = excellent
Dimensions:
- onBrief: did it faithfully execute the brief's assetXElement and insight
- legible: can the audience understand what's happening within one second
- shareable: does the audience feel an urge to share/remix it`;

// brandFit is the fourth judge dimension: when a brand pack is configured
// (BRAND_PACK env var naming a directory under brand/), score how well the
// asset clears that pack's brand.md "How the machine uses this" checks
// (restraint / register / rights), same rule skill/SKILL.md station 6
// documents. When no pack is configured, brandFit is never asked of the
// model at all: it is hardcoded to 2 in scoreAsset below, a deterministic
// default rather than a guess.
function brandFitPromptSection(brandChecks: string | null): string {
  if (!brandChecks) {
    return `- brandFit: no brand pack is configured for this run (see BRAND_PACK env var); do not
  score this, it defaults to 2.`;
  }
  return `- brandFit: read the brand checks below (restraint / register / rights) and score how
  well the asset clears all three. 1 = fails a check, 2 = clears with no issue, 3 = clears
  and turns the check into a specific, insight-native beat.

${brandChecks}`;
}

function buildSystemPrompt(brandChecks: string | null): string {
  return `${JUDGE_BASE_PROMPT}
${brandFitPromptSection(brandChecks)}

Output must be strict JSON, in English: {"onBrief":1|2|3,"legible":1|2|3,"shareable":1|2|3,"brandFit":1|2|3,"notes":"..."}
Output nothing outside the JSON.`;
}

// any dimension scoring 1 counts as a fail, brandFit included -- same rule
// skill/SKILL.md station 6 enforces. brandFit defaults to 2 when no brand
// pack is configured, so a pack-less run can never fail on this dimension.
function isFail(score: JudgeScore): boolean {
  return score.onBrief === 1 || score.legible === 1 || score.shareable === 1 || score.brandFit === 1;
}

function mockDimension(rng: () => number): 1 | 2 | 3 {
  const r = rng();
  if (r < 0.12) return 1;
  if (r < 0.55) return 2;
  return 3;
}

function mockScore(name: string, attempt: number, brandChecks: string | null): JudgeScore {
  const seed = hashString(`${name}#attempt${attempt}`);
  const rng = mulberry32(seed);
  const score: JudgeScore = { onBrief: mockDimension(rng), legible: mockDimension(rng), shareable: mockDimension(rng) };
  // only draw a fourth mock dimension when a pack is actually configured, so
  // pack-less mock runs keep the exact rng sequence they always have
  score.brandFit = brandChecks ? mockDimension(rng) : 2;
  return score;
}

// BRAND_PACK names a directory under brand/, matching the env-var posture
// lib/openai-client.ts already uses for MODEL/IMAGE_MODEL: a minimal,
// optional hook, not a config system. Unset -> no brand pack -> brandFit
// always defaults to 2.
function brandPackName(): string | null {
  return process.env.BRAND_PACK || null;
}

// Reads brand/<pack>/brand.md's "How the machine uses this" section (the
// three on-brand checks) verbatim into the judge prompt. Missing pack, or a
// pack with no brand.md, both resolve to null -> brandFit defaults to 2.
async function loadBrandChecks(pack: string | null): Promise<string | null> {
  if (!pack) return null;
  const brandPath = path.join(process.cwd(), "brand", pack, "brand.md");
  if (!(await fileExists(brandPath))) return null;
  const raw = await readFile(brandPath, "utf-8");
  const marker = "## How the machine uses this";
  const idx = raw.indexOf(marker);
  return idx === -1 ? raw : raw.slice(idx);
}

async function scoreAsset(
  produced: ProducedAsset,
  brief: Brief,
  attempt: number,
  brandChecks: string | null
): Promise<{ score: JudgeScore; notes: string }> {
  if (isMockMode()) {
    return { score: mockScore(produced.name, attempt, brandChecks), notes: `[mock judge] attempt ${attempt}` };
  }
  const raw = await chatComplete({
    system: buildSystemPrompt(brandChecks),
    user: `brief: ${JSON.stringify(brief)}\nproduced: ${JSON.stringify({ copy: produced.copy, motionScript: produced.motionScript, name: produced.name })}`,
    model: DEFAULT_MODEL,
  });
  const match = raw.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(match ? match[0] : raw) as JudgeScore & { notes: string };
  const score: JudgeScore = {
    onBrief: parsed.onBrief,
    legible: parsed.legible,
    shareable: parsed.shareable,
    // ignore whatever the model returned for brandFit when no pack backs
    // the dimension: 2 is the contract, not a model guess
    brandFit: brandChecks ? parsed.brandFit : 2,
  };
  return { score, notes: parsed.notes ?? "" };
}

export async function runJudge(
  assetsDir: string,
  namedAsset: NamedAsset,
  brief: Brief,
  initialProduced: ProducedAsset
): Promise<{ produced: ProducedAsset; judgeResult: JudgeResult }> {
  const brandChecks = await loadBrandChecks(brandPackName());

  let produced = initialProduced;
  let attempt = 1;
  let { score, notes } = await scoreAsset(produced, brief, attempt, brandChecks);

  if (isFail(score) && attempt === 1) {
    // at most one regeneration
    produced = await runProduce(assetsDir, namedAsset, brief);
    produced.regeneratedCount = 1;
    attempt = 2;
    ({ score, notes } = await scoreAsset(produced, brief, attempt, brandChecks));
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
