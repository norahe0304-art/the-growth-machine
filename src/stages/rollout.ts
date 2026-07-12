/**
 * [INPUT]: depends on lib/openai-client's chatComplete/isMockMode/DEFAULT_MODEL, on lib/hash's
 *   hashString/mulberry32, on types.ts's Variant/Brief/Decision/PreRegisteredThresholds/
 *   RolloutDraft/RolloutChannelPlan/RolloutRole
 * [OUTPUT]: exports runRollout(params) -> Promise<RolloutDraft>, the SCALE winner's
 *   channel-by-channel playbook; and validateRolloutDraft(input) -> {ok:true} | {ok:false,
 *   errors:string[]}, the pure schema gate scripts/machine.mjs rollout-validate calls
 * [POS]: station 8b of the pipeline, runs only for SCALE verdicts, sits between decide.ts and
 *   report.ts. Same rules-plus-one-model-call shape as plan.ts, except the model writes a full
 *   channel breakdown instead of a single rationale sentence
 * [PROTOCOL]: update this header on change, then check CLAUDE.md
 */
import { chatComplete, isMockMode, DEFAULT_MODEL } from "../lib/openai-client.js";
import { hashString, mulberry32 } from "../lib/hash.js";
import type {
  AngleType,
  Brief,
  Decision,
  PreRegisteredThresholds,
  RolloutChannelPlan,
  RolloutDraft,
  RolloutRole,
  Variant,
} from "../types.js";

// ============================================================
// Mock path: a fixed channel and role playbook per angleType, sliced to 3
// or 4 entries by a seed derived from the asset name, same determinism
// contract every other mock path in this repo already follows.
// ============================================================
const CHANNEL_ROLE_PLAYBOOK: Record<AngleType, Array<{ channel: string; role: RolloutRole }>> = {
  moment: [
    { channel: "tiktok", role: "discovery" },
    { channel: "x", role: "amplification" },
    { channel: "instagram", role: "conversion" },
    { channel: "in-app profile surface", role: "retention" },
  ],
  evergreen: [
    { channel: "instagram", role: "discovery" },
    { channel: "in-app profile surface", role: "retention" },
    { channel: "tiktok", role: "amplification" },
    { channel: "x", role: "conversion" },
  ],
  "ugc-loop": [
    { channel: "tiktok", role: "amplification" },
    { channel: "instagram", role: "discovery" },
    { channel: "in-app profile surface", role: "retention" },
    { channel: "x", role: "conversion" },
  ],
};

const ASSET_SPEC_BY_CHANNEL: Record<string, string> = {
  tiktok: "Vertical 9:16 cut under 15 seconds, the hook restated as on screen text in the first 2 seconds.",
  instagram: "Square 1:1 feed crop plus a 9:16 Reel cut, the graft framed as the thumbnail focal point.",
  x: "16:9 still posted natively, the copy line carried as the post text, the graft kept legible at preview size.",
  "in-app profile surface": "1:1 crop tuned for the platform's own circular mask, the graft positioned to survive the crop.",
};

function executionStepsFor(channel: string, role: RolloutRole, brief: Brief): string[] {
  const steps = [
    `Ship the ${channel} cut inside the first 48 hours of the observation window.`,
    `Lead with the formula hook: ${brief.assetXElement}.`,
  ];
  if (role === "discovery") steps.push(`Seed the post directly into the audience segment: ${brief.audience}.`);
  if (role === "amplification") steps.push(`Cross post the same cut from at least one adjacent account to widen reach.`);
  if (role === "retention") steps.push(`Prompt the viewer to carry the graft into their own profile before the post ages out.`);
  if (role === "conversion") steps.push(`Pin a direct link back to the asset so the call to action has one clear next step.`);
  steps.push(`Track ${channel} performance against the wave's preregistered thresholds every day.`);
  return steps.slice(0, 4);
}

function kpiFor(channel: string, thresholds: PreRegisteredThresholds): { kpi: string; kpiThresholdNote: string } {
  const pct = (thresholds.scaleAt * 100).toFixed(1);
  return {
    kpi: `${pct}% ${channel} engagement rate inside the 21 day window`,
    kpiThresholdNote: `Matches the plan's preregistered scaleAt of ${thresholds.scaleAt}. A ${channel} reading at or above this rate counts as a SCALE equivalent signal for this channel.`,
  };
}

function mockRolloutDraft(
  variant: Variant,
  brief: Brief,
  namedAssetName: string,
  thresholds: PreRegisteredThresholds
): RolloutDraft {
  const playbook = CHANNEL_ROLE_PLAYBOOK[variant.angleType];
  const seed = hashString(`${namedAssetName}#rollout`);
  const rng = mulberry32(seed);
  const channelCount = rng() < 0.5 ? 3 : 4;

  const channels: RolloutChannelPlan[] = playbook.slice(0, channelCount).map(({ channel, role }) => {
    const { kpi, kpiThresholdNote } = kpiFor(channel, thresholds);
    return {
      channel,
      role,
      assetSpec:
        ASSET_SPEC_BY_CHANNEL[channel] ??
        `Format tuned for ${channel}, the hook adapted to the channel's native pacing.`,
      executionSteps: executionStepsFor(channel, role, brief),
      kpi,
      kpiThresholdNote,
    };
  });

  return { variantId: variant.id, name: namedAssetName, channels };
}

// ============================================================
// Real path: one model call, same prompt contract skill/SKILL.md's
// "Station 8b, rollout" section documents for the agent-authored path.
// ============================================================
const ROLLOUT_SYSTEM_PROMPT = `You are the rollout station of The Growth Machine. You run only for a variant that already earned a SCALE verdict.
Write a channel by channel playbook for the winning asset. Pick 3 to 4 relevant channels, for example tiktok, instagram, x, or an in-app profile surface.
Every field is a plain declarative sentence. Do not use an em dash or an en dash anywhere in the output.
role must be exactly one of: discovery, amplification, retention, conversion.
executionSteps must have 3 to 4 entries, each one action sentence.
kpi is one concrete number tied to an outcome. kpiThresholdNote is one sentence linking that number back to the plan's preregistered threshold system.

Output must be strict JSON, in English:
{"variantId":"...","name":"...","channels":[{"channel":"...","role":"discovery|amplification|retention|conversion","assetSpec":"...","executionSteps":["...","...","..."],"kpi":"...","kpiThresholdNote":"..."}]}
Output nothing outside the JSON.`;

export async function runRollout(params: {
  variant: Variant;
  brief: Brief;
  decision: Decision;
  namedAssetName: string;
  thresholds: PreRegisteredThresholds;
}): Promise<RolloutDraft> {
  const { variant, brief, decision, namedAssetName, thresholds } = params;

  if (isMockMode()) {
    return mockRolloutDraft(variant, brief, namedAssetName, thresholds);
  }

  const raw = await chatComplete({
    system: ROLLOUT_SYSTEM_PROMPT,
    user: `winning variant: ${JSON.stringify(variant)}\nbrief: ${JSON.stringify(brief)}\ndecision: ${JSON.stringify(decision)}\nnamed asset: ${namedAssetName}\nthresholds: ${JSON.stringify(thresholds)}`,
    model: DEFAULT_MODEL,
  });

  try {
    const match = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : raw) as RolloutDraft;
    const check = validateRolloutDraft(parsed);
    if (!check.ok) throw new Error(`model output failed rollout schema: ${check.errors.join("; ")}`);
    return parsed;
  } catch (err) {
    // model output was not usable: degrade to the deterministic template
    // instead of failing the whole wave, same posture plan.ts takes for its
    // rationale sentence.
    console.warn(
      `[rollout] model output invalid (${err instanceof Error ? err.message : String(err)}), falling back to the deterministic rollout template`
    );
    return mockRolloutDraft(variant, brief, namedAssetName, thresholds);
  }
}

// ============================================================
// Schema gate: pure validation, no I/O, no model call. This is what
// scripts/machine.mjs rollout-validate calls, so the skill-mode agent can
// check its own hand-written JSON before it ever touches readout.json.
// ============================================================
const VALID_ROLES: RolloutRole[] = ["discovery", "amplification", "retention", "conversion"];
const DASH_RE = /[\u2013\u2014]/; // en dash (u2013), em dash (u2014), matched by escape, not by a literal glyph

function checkDash(value: unknown, fieldPath: string, errors: string[]): void {
  if (typeof value === "string" && DASH_RE.test(value)) {
    errors.push(`${fieldPath}: contains an em dash or en dash, use a plain declarative sentence instead`);
  }
}

export function validateRolloutDraft(input: unknown): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];

  if (typeof input !== "object" || input === null) {
    return { ok: false, errors: ["input is not an object"] };
  }
  const draft = input as Partial<RolloutDraft>;

  if (typeof draft.variantId !== "string" || draft.variantId.length === 0) {
    errors.push("variantId: missing or not a string");
  }
  if (typeof draft.name !== "string" || draft.name.length === 0) {
    errors.push("name: missing or not a string");
  }
  if (!Array.isArray(draft.channels)) {
    errors.push("channels: missing or not an array");
    return { ok: false, errors };
  }
  if (draft.channels.length < 3 || draft.channels.length > 4) {
    errors.push(`channels: must have 3 to 4 entries, got ${draft.channels.length}`);
  }

  draft.channels.forEach((entry, i) => {
    const fieldPath = `channels[${i}]`;
    if (typeof entry !== "object" || entry === null) {
      errors.push(`${fieldPath}: not an object`);
      return;
    }
    const channelPlan = entry as Partial<RolloutChannelPlan>;

    if (typeof channelPlan.channel !== "string" || channelPlan.channel.length === 0) {
      errors.push(`${fieldPath}.channel: missing or not a string`);
    }
    if (typeof channelPlan.role !== "string" || !VALID_ROLES.includes(channelPlan.role as RolloutRole)) {
      errors.push(`${fieldPath}.role: must be one of ${VALID_ROLES.join("/")}`);
    }
    if (typeof channelPlan.assetSpec !== "string" || channelPlan.assetSpec.length === 0) {
      errors.push(`${fieldPath}.assetSpec: missing or not a string`);
    }
    if (
      !Array.isArray(channelPlan.executionSteps) ||
      channelPlan.executionSteps.length < 3 ||
      channelPlan.executionSteps.length > 4
    ) {
      errors.push(`${fieldPath}.executionSteps: must have 3 to 4 entries`);
    } else {
      channelPlan.executionSteps.forEach((step, j) => {
        if (typeof step !== "string" || step.length === 0) {
          errors.push(`${fieldPath}.executionSteps[${j}]: not a string`);
        }
        checkDash(step, `${fieldPath}.executionSteps[${j}]`, errors);
      });
    }
    if (typeof channelPlan.kpi !== "string" || channelPlan.kpi.length === 0) {
      errors.push(`${fieldPath}.kpi: missing or not a string`);
    }
    if (typeof channelPlan.kpiThresholdNote !== "string" || channelPlan.kpiThresholdNote.length === 0) {
      errors.push(`${fieldPath}.kpiThresholdNote: missing or not a string`);
    }
    checkDash(channelPlan.assetSpec, `${fieldPath}.assetSpec`, errors);
    checkDash(channelPlan.kpi, `${fieldPath}.kpi`, errors);
    checkDash(channelPlan.kpiThresholdNote, `${fieldPath}.kpiThresholdNote`, errors);
  });

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
