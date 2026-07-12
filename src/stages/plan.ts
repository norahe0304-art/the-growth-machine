/**
 * [INPUT]: depends on lib/openai-client's chatComplete/isMockMode, on types.ts's AngleType/NamedAsset/Plan/PlanArm/PreRegisteredThresholds/Variant
 * [OUTPUT]: exports runPlan(...) -> Plan, PRE_REGISTERED_THRESHOLDS (simulated-CTR decide path) and ENGAGEMENT_THRESHOLDS (measured-engagementRate decide path) constant tables
 * [POS]: station 4 of the nine-station pipeline; rules decide thresholds and traffic split, the LLM only contributes one rationale sentence
 * [PROTOCOL]: update this header on change, then check CLAUDE.md
 */
import { chatComplete, isMockMode, DEFAULT_MODEL } from "../lib/openai-client.js";
import type { AngleType, NamedAsset, Plan, PlanArm, PreRegisteredThresholds, Variant } from "../types.js";

// ============================================================
// Preregistered threshold table: hardcoded, never mutated at decide time;
// that immutability is the whole point of preregistration, you can't move
// the goalposts after seeing the curve.
// scaleAt/killAt are CTR (0-1), fatigueSlope is the tail-slope threshold
// (more negative = more fatigued). The three angle types get different
// thresholds: moment peaks fast and tolerates fatigue; evergreen demands
// stability; ugc-loop gets the longest observation window and the highest
// scale bar, because it's built to compound.
// ============================================================
export const PRE_REGISTERED_THRESHOLDS: Record<AngleType, PreRegisteredThresholds> = {
  moment: { scaleAt: 0.045, killAt: 0.015, fatigueSlope: -0.004 },
  evergreen: { scaleAt: 0.035, killAt: 0.012, fatigueSlope: -0.0015 },
  "ugc-loop": { scaleAt: 0.05, killAt: 0.018, fatigueSlope: -0.002 },
};

// ============================================================
// Engagement-rate threshold table: the measured-data decide path uses this
// instead of PRE_REGISTERED_THRESHOLDS. engagementRate = (likes + comments +
// shares + saves) / impressions, which typically runs an order of magnitude
// higher than CTR, so the bars are set on a different scale, same shape.
// ============================================================
export const ENGAGEMENT_THRESHOLDS: Record<AngleType, PreRegisteredThresholds> = {
  moment: { scaleAt: 0.08, killAt: 0.02, fatigueSlope: -0.01 },
  evergreen: { scaleAt: 0.06, killAt: 0.015, fatigueSlope: -0.004 },
  "ugc-loop": { scaleAt: 0.1, killAt: 0.025, fatigueSlope: -0.006 },
};

const OBSERVATION_WINDOW_DAYS = 21; // fixed three-week, day-level curve window

function budgetFor(angleType: AngleType): number {
  // illustrative budget, not a real media budget: moment spends in a burst, evergreen/ugc-loop spread thin
  if (angleType === "moment") return 500;
  if (angleType === "ugc-loop") return 350;
  return 250;
}

function trafficSplitFor(arms: number): number {
  return Math.round((100 / arms) * 100) / 100;
}

const PLAN_SYSTEM_PROMPT = `You are the plan-station engine of The Growth Machine.
Thresholds and traffic split are already computed by rules; you only need one sentence explaining this test plan's logic (why this split, why this observation window).
Output must be strict JSON, in English: {"rationale":"..."}
Output nothing outside the JSON.`;

function mockRationale(moment: string, waveNumber: number): string {
  return `Wave ${waveNumber} splits traffic evenly across three variants for "${moment}"; the 21-day observation window covers the full fatigue-curve inflection point`;
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
        user: `moment: "${moment}"\nwave ${waveNumber}\narms: ${JSON.stringify(arms)}`,
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
    engagementThresholds: ENGAGEMENT_THRESHOLDS,
    dates: {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
      days: OBSERVATION_WINDOW_DAYS,
    },
    rationale,
  };
}
