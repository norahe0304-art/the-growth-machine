/**
 * [INPUT]: depends on lib/openai-client's chatComplete/generateImage/isMockMode/DEFAULT_MODEL,
 *   on lib/hash's hashString/mulberry32, on lib/fs-utils's ensureDir, on taxonomy.ts's
 *   channelToken/deriveChannelAssetName, on node:fs/promises + node:path, on types.ts's
 *   Variant/Brief/Decision/PreRegisteredThresholds/RolloutDraft/RolloutChannelPlan/RolloutRole
 * [OUTPUT]: exports runRollout(params) -> Promise<RolloutDraft>, the SCALE winner's
 *   channel-by-channel playbook, now with a produced channel cut (nativeFormat/assetName/
 *   assetPath/channelCopy/channelScript) per channel; and validateRolloutDraft(input) ->
 *   {ok:true} | {ok:false, errors:string[]}, the pure schema gate scripts/machine.mjs
 *   rollout-validate calls
 * [POS]: station 8b of the pipeline, runs only for SCALE verdicts, sits between decide.ts and
 *   report.ts. Same rules-plus-one-model-call shape as plan.ts, except the model writes a full
 *   channel breakdown instead of a single rationale sentence, and each channel entry ends in
 *   its own real (or mock-placeholder) generation call, the same posture produce.ts takes for
 *   the concept-level still. A channel cut is an expansion arm off the winning concept, not a
 *   fresh idea: the concept already won the wave, every channel cut still earns its own
 *   SCALE/KILL verdict against its own kpi below. Format follows the channel: video channels
 *   get a three-shot script plus a cover frame, ugc channels get a candid phone-shot still,
 *   editorial channels get a native still, surface channels get a mask-safe crop.
 * [PROTOCOL]: update this header on change, then check CLAUDE.md
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { chatComplete, generateImage, isMockMode, DEFAULT_MODEL } from "../lib/openai-client.js";
import { hashString, mulberry32 } from "../lib/hash.js";
import { ensureDir } from "../lib/fs-utils.js";
import { channelToken, deriveChannelAssetName } from "../taxonomy.js";
import type {
  AngleType,
  Brief,
  Decision,
  PreRegisteredThresholds,
  RolloutChannelPlan,
  RolloutDraft,
  RolloutNativeFormat,
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
  tiktok:
    "Native vertical video under 15 seconds, delivered as a ChatCut ready three shot script plus a 9:16 cover frame, the hook restated as on screen text in the first 2 seconds.",
  instagram:
    "Creator aesthetic 1:1 still that reads as shot on a phone, candid light, the graft visible but unretouched and unstaged.",
  x: "16:9 still posted natively, the copy line carried as the post text, the graft kept legible at preview size.",
  "in-app profile surface": "1:1 crop tuned for the platform's own circular mask, the graft positioned to survive the crop.",
};

// ============================================================
// Format follows the channel: the native delivery format is a property of
// the channel itself, derived here, never chosen by a model. An unlisted
// channel defaults to a plain still, the least opinionated format.
// ============================================================
const NATIVE_FORMAT_BY_CHANNEL: Record<string, RolloutNativeFormat> = {
  tiktok: "video",
  instagram: "ugc-still",
  x: "still",
  "in-app profile surface": "surface",
};

export function nativeFormatForChannel(channel: string): RolloutNativeFormat {
  return NATIVE_FORMAT_BY_CHANNEL[channel.trim().toLowerCase()] ?? "still";
}

// Video channels ship a ChatCut-ready three-shot script whose shot 3 lands
// the channelCopy. Deterministic template, same shape produce.ts's motion
// storyboard already uses.
function channelScriptFor(nativeFormat: RolloutNativeFormat, brief: Brief, channelCopy: string): string[] | null {
  if (nativeFormat !== "video") return null;
  return [
    `Shot 1 (establish): the winning still's subject in its everyday context, ${brief.assetXElement.split(" x ")[0] ?? "the asset"} untouched, no sound cue yet`,
    `Shot 2 (contrast): the new element lands as a visual break, cut on the [for ChatCut] rhythm`,
    `Shot 3 (land): hook copy locks in: ${channelCopy} Frame holds for 1.5s, end`,
  ];
}

// ============================================================
// Channel cut copy: one finished line per channel, in that channel's own
// voice. Deterministic in mock mode (no LLM call, same posture every other
// mock path in this file takes); the real path asks the model for it as
// part of the same JSON call that writes the rest of the channel entry.
// ============================================================
const CHANNEL_COPY_VOICE: Record<string, (variant: Variant) => string> = {
  tiktok: (v) => `Wait for it. ${v.workingTitle}.`,
  instagram: (v) => `Swipe closer. ${v.workingTitle}.`,
  x: (v) => `New drop, same thread. ${v.workingTitle}.`,
  "in-app profile surface": (v) => `One tap upgrade. ${v.workingTitle}.`,
};

function mockChannelCopy(channel: string, variant: Variant): string {
  const voice = CHANNEL_COPY_VOICE[channel.trim().toLowerCase()];
  return voice ? voice(variant) : `${channel} cut is live. ${variant.workingTitle}.`;
}

// ============================================================
// Channel cut image: same ratios the assetSpec sentences above already
// promise, mapped to generateImage's size enum so the real render and the
// mock placeholder always agree on aspect ratio.
// ============================================================
const IMAGE_SIZE_BY_CHANNEL: Record<string, "1024x1024" | "1536x1024" | "1024x1536"> = {
  instagram: "1024x1024", // square feed crop
  tiktok: "1024x1536", // vertical 9:16
  x: "1536x1024", // 16:9 native still
  "in-app profile surface": "1024x1024", // square, safe inside a circular mask
};

function imageSizeForChannel(channel: string): "1024x1024" | "1536x1024" | "1024x1536" {
  return IMAGE_SIZE_BY_CHANNEL[channel.trim().toLowerCase()] ?? "1536x1024";
}

function escapeXML(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function placeholderChannelSVG(assetName: string, channel: string, prompt: string): string {
  const [wStr, hStr] = imageSizeForChannel(channel).split("x");
  const w = Number(wStr);
  const h = Number(hStr);
  const wrapped = prompt.length > 90 ? prompt.slice(0, 87) + "..." : prompt;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="#fafaf8"/>
  <rect x="1" y="1" width="${w - 2}" height="${h - 2}" fill="none" stroke="#d8d5cd" stroke-width="2"/>
  <text x="${w / 2}" y="${h / 2 - 20}" font-family="Georgia, serif" font-size="26" fill="#1a1a1a" text-anchor="middle">${escapeXML(assetName)}</text>
  <text x="${w / 2}" y="${h / 2 + 20}" font-family="Georgia, serif" font-size="16" fill="#6b6b63" text-anchor="middle">${escapeXML(channel)} channel cut</text>
  <text x="${w / 2}" y="${h - 40}" font-family="monospace" font-size="14" fill="#a8a59c" text-anchor="middle">MOCK ASSET: no real generation</text>
  <text x="${w / 2}" y="${wrapped ? h - 16 : h}" font-family="monospace" font-size="11" fill="#c8c5bc" text-anchor="middle">${escapeXML(wrapped)}</text>
</svg>`;
}

// The image prompt tail per native format: video gets a cover frame with the
// hook as large on-screen text, ugc gets a candid phone-shot restyle, still
// carries the hook line in frame, surface stays safe inside a circular mask.
function imagePromptFor(ch: RolloutChannelPlan, baseImagePrompt: string): string {
  const treatments: Record<RolloutNativeFormat, string> = {
    video: `Produce the 9:16 vertical cover frame for the ${ch.channel} video: the hook restated as large bold on screen text at the top of the frame, reading exactly: ${ch.channelCopy}`,
    "ugc-still": `Restyle as a creator's own phone shot for ${ch.channel}: shot on a phone, candid, natural imperfect light, creator aesthetic, not retouched, not staged, same subject and same graft as the winning still.`,
    still: `Produce the native 16:9 still for ${ch.channel} with the hook line carried in frame: ${ch.channelCopy}`,
    surface: `Produce the 1:1 crop for the ${ch.channel}, composed so the subject and the graft stay safe inside a circular mask.`,
  };
  return `${baseImagePrompt} Adapt for the channel's native format (${ch.nativeFormat}): ${ch.assetSpec} ${treatments[ch.nativeFormat]}`;
}

// Renders one channel's cut: mock mode writes a placeholder SVG, real mode
// calls generateImage with the winner's original image prompt rewritten for
// this channel's native format. A failed real call degrades to assetPath:
// null instead of failing the whole rollout, same posture produce.ts's
// still-asset path never even needs, because this call is already the
// fallback tail of a station that already succeeded once.
async function produceChannelAsset(
  rolloutAssetsDir: string,
  ch: RolloutChannelPlan,
  baseImagePrompt: string
): Promise<string | null> {
  await ensureDir(rolloutAssetsDir);
  const prompt = imagePromptFor(ch, baseImagePrompt);

  if (isMockMode()) {
    const svgPath = path.join(rolloutAssetsDir, `${ch.assetName}.svg`);
    await writeFile(svgPath, placeholderChannelSVG(ch.assetName, ch.channel, prompt), "utf-8");
    return svgPath;
  }

  try {
    const { b64 } = await generateImage({ prompt, size: imageSizeForChannel(ch.channel) });
    const pngPath = path.join(rolloutAssetsDir, `${ch.assetName}.png`);
    await writeFile(pngPath, Buffer.from(b64, "base64"));
    return pngPath;
  } catch (err) {
    console.warn(
      `[rollout] channel cut generation failed for "${ch.channel}" (${err instanceof Error ? err.message : String(err)}), leaving assetPath null`
    );
    return null;
  }
}

// Fills in assetPath for every channel in a draft, writing each cut into
// waves/wave-{NN}/assets/rollout/. Runs after the draft has its full text
// content (and, on the real path, after validation), same ordering the
// skill layer's Station 8b instructions follow: write and validate the
// playbook first, then produce the channel cut.
async function produceChannelAssets(draft: RolloutDraft, brief: Brief, assetsDir: string): Promise<RolloutDraft> {
  const rolloutAssetsDir = path.join(assetsDir, "rollout");
  const channels = await Promise.all(
    draft.channels.map(async (ch) => ({
      ...ch,
      assetPath: await produceChannelAsset(rolloutAssetsDir, ch, brief.generationPrompts.image),
    }))
  );
  return { ...draft, channels };
}

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

async function mockRolloutDraft(
  variant: Variant,
  brief: Brief,
  namedAssetName: string,
  thresholds: PreRegisteredThresholds,
  assetsDir: string
): Promise<RolloutDraft> {
  const playbook = CHANNEL_ROLE_PLAYBOOK[variant.angleType];
  const seed = hashString(`${namedAssetName}#rollout`);
  const rng = mulberry32(seed);
  const channelCount = rng() < 0.5 ? 3 : 4;

  const channels: RolloutChannelPlan[] = playbook.slice(0, channelCount).map(({ channel, role }) => {
    const { kpi, kpiThresholdNote } = kpiFor(channel, thresholds);
    const nativeFormat = nativeFormatForChannel(channel);
    const channelCopy = mockChannelCopy(channel, variant);
    return {
      channel,
      role,
      nativeFormat,
      assetName: deriveChannelAssetName(namedAssetName, channel),
      assetPath: null,
      channelCopy,
      channelScript: channelScriptFor(nativeFormat, brief, channelCopy),
      assetSpec:
        ASSET_SPEC_BY_CHANNEL[channel] ??
        `Format tuned for ${channel}, the hook adapted to the channel's native pacing.`,
      executionSteps: executionStepsFor(channel, role, brief),
      kpi,
      kpiThresholdNote,
    };
  });

  const draft: RolloutDraft = { variantId: variant.id, name: namedAssetName, channels };
  return produceChannelAssets(draft, brief, assetsDir);
}

// ============================================================
// Real path: one model call, same prompt contract skill/SKILL.md's
// "Station 8b, rollout" section documents for the agent-authored path.
// ============================================================
const ROLLOUT_SYSTEM_PROMPT = `You are the rollout station of The Growth Machine. You run only for a variant that already earned a SCALE verdict.
Write a channel by channel playbook for the winning asset. Pick 3 to 4 relevant channels, for example tiktok, instagram, x, or an in-app profile surface.
Every field is a plain declarative sentence. Do not use an em dash or an en dash anywhere in the output.
Each channel is an expansion arm off a concept that already won, not a new idea: it will earn its own SCALE or KILL verdict against the kpi you write below, separate from the concept-level test.
role must be exactly one of: discovery, amplification, retention, conversion.
executionSteps must have 3 to 4 entries, each one action sentence.
kpi is one concrete number tied to an outcome. kpiThresholdNote is one sentence linking that number back to the plan's preregistered threshold system.
channelCopy is one line of finished, ready to ship ad copy written in that channel's native voice: tiktok terse and punchy, instagram colloquial creator caption, x conversational, an in-app surface a one tap prompt.
Format follows the channel: a video channel ships a three shot script plus a cover frame, a ugc channel ships a candid creator still, an editorial channel ships a native still, an in-product surface ships a mask safe crop. Write assetSpec accordingly.

Output must be strict JSON, in English:
{"variantId":"...","name":"...","channels":[{"channel":"...","role":"discovery|amplification|retention|conversion","assetSpec":"...","executionSteps":["...","...","..."],"kpi":"...","kpiThresholdNote":"...","channelCopy":"..."}]}
Output nothing outside the JSON. Do not include assetName, assetPath, nativeFormat, or channelScript, those are assigned after your output validates.`;

export async function runRollout(params: {
  variant: Variant;
  brief: Brief;
  decision: Decision;
  namedAssetName: string;
  thresholds: PreRegisteredThresholds;
  assetsDir: string;
}): Promise<RolloutDraft> {
  const { variant, brief, decision, namedAssetName, thresholds, assetsDir } = params;

  if (isMockMode()) {
    return mockRolloutDraft(variant, brief, namedAssetName, thresholds, assetsDir);
  }

  const raw = await chatComplete({
    system: ROLLOUT_SYSTEM_PROMPT,
    user: `winning variant: ${JSON.stringify(variant)}\nbrief: ${JSON.stringify(brief)}\ndecision: ${JSON.stringify(decision)}\nnamed asset: ${namedAssetName}\nthresholds: ${JSON.stringify(thresholds)}`,
    model: DEFAULT_MODEL,
  });

  try {
    const match = raw.match(/\{[\s\S]*\}/);
    const parsedRaw = JSON.parse(match ? match[0] : raw) as {
      variantId: string;
      name: string;
      channels: Array<Omit<RolloutChannelPlan, "assetName" | "assetPath" | "nativeFormat" | "channelScript">>;
    };
    // assetName is a deterministic lineage swap and nativeFormat is a
    // property of the channel, never model-authored: stamp both (plus a
    // not-yet-produced assetPath and, for video channels, the three-shot
    // script) onto every channel before the draft goes through the schema
    // gate.
    const channels: RolloutChannelPlan[] = (parsedRaw.channels ?? []).map((ch) => {
      const nativeFormat = nativeFormatForChannel(ch.channel);
      return {
        ...ch,
        nativeFormat,
        assetName: deriveChannelAssetName(namedAssetName, ch.channel),
        assetPath: null,
        channelScript: channelScriptFor(nativeFormat, brief, ch.channelCopy),
      };
    });
    const parsed: RolloutDraft = { variantId: parsedRaw.variantId, name: parsedRaw.name, channels };
    const check = validateRolloutDraft(parsed);
    if (!check.ok) throw new Error(`model output failed rollout schema: ${check.errors.join("; ")}`);
    return await produceChannelAssets(parsed, brief, assetsDir);
  } catch (err) {
    // model output was not usable: degrade to the deterministic template
    // instead of failing the whole wave, same posture plan.ts takes for its
    // rationale sentence.
    console.warn(
      `[rollout] model output invalid (${err instanceof Error ? err.message : String(err)}), falling back to the deterministic rollout template`
    );
    return mockRolloutDraft(variant, brief, namedAssetName, thresholds, assetsDir);
  }
}

// ============================================================
// Schema gate: pure validation, no I/O, no model call. This is what
// scripts/machine.mjs rollout-validate calls, so the skill-mode agent can
// check its own hand-written JSON before it ever touches readout.json.
// ============================================================
const VALID_ROLES: RolloutRole[] = ["discovery", "amplification", "retention", "conversion"];
const VALID_NATIVE_FORMATS: RolloutNativeFormat[] = ["video", "ugc-still", "still", "surface"];
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
    if (typeof channelPlan.assetName !== "string" || channelPlan.assetName.length === 0) {
      errors.push(`${fieldPath}.assetName: missing or not a string`);
    } else {
      const segments = channelPlan.assetName.split("_");
      if (segments.length !== 9) {
        errors.push(`${fieldPath}.assetName: must have 9 underscore separated segments, got ${segments.length}`);
      } else if (typeof channelPlan.channel === "string" && channelPlan.channel.length > 0) {
        const expected = channelToken(channelPlan.channel);
        if (segments[0] !== expected) {
          errors.push(
            `${fieldPath}.assetName: CHANNEL segment "${segments[0]}" does not match channel "${channelPlan.channel}" (expected "${expected}")`
          );
        }
      }
    }
    if (channelPlan.assetPath !== null && channelPlan.assetPath !== undefined && typeof channelPlan.assetPath !== "string") {
      errors.push(`${fieldPath}.assetPath: must be a string or null`);
    }
    if (
      typeof channelPlan.nativeFormat !== "string" ||
      !VALID_NATIVE_FORMATS.includes(channelPlan.nativeFormat as RolloutNativeFormat)
    ) {
      errors.push(`${fieldPath}.nativeFormat: must be one of ${VALID_NATIVE_FORMATS.join("/")}`);
    } else if (typeof channelPlan.channel === "string" && channelPlan.channel.length > 0) {
      const expectedFormat = nativeFormatForChannel(channelPlan.channel);
      if (channelPlan.nativeFormat !== expectedFormat) {
        errors.push(
          `${fieldPath}.nativeFormat: "${channelPlan.nativeFormat}" does not match channel "${channelPlan.channel}" (expected "${expectedFormat}")`
        );
      }
    }
    if (channelPlan.nativeFormat === "video") {
      if (!Array.isArray(channelPlan.channelScript) || channelPlan.channelScript.length !== 3) {
        errors.push(`${fieldPath}.channelScript: a video channel must carry a three-shot script (3 entries)`);
      } else {
        channelPlan.channelScript.forEach((shot, j) => {
          if (typeof shot !== "string" || shot.length === 0) {
            errors.push(`${fieldPath}.channelScript[${j}]: not a string`);
          }
          checkDash(shot, `${fieldPath}.channelScript[${j}]`, errors);
        });
      }
    } else if (channelPlan.channelScript !== null && channelPlan.channelScript !== undefined) {
      errors.push(`${fieldPath}.channelScript: must be null for a non-video channel`);
    }
    if (typeof channelPlan.channelCopy !== "string" || channelPlan.channelCopy.length === 0) {
      errors.push(`${fieldPath}.channelCopy: missing or not a string`);
    }
    checkDash(channelPlan.channelCopy, `${fieldPath}.channelCopy`, errors);
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
