/**
 * [INPUT]: depends on node:test/node:assert, node:child_process, node:path, node:url, on
 *   src/stages/rollout.ts's validateRolloutDraft, on src/taxonomy.ts's channelToken/
 *   deriveChannelAssetName, on scripts/machine.mjs as a real subprocess
 * [OUTPUT]: unit tests proving validateRolloutDraft accepts a well-formed RolloutDraft and
 *   rejects the specific ways a hand-authored one can go wrong: bad channel count, bad role,
 *   an em or en dash slipped into a sentence field, a missing/malformed channelCopy, an
 *   assetName whose CHANNEL segment doesn't match its channel or that isn't nine segments, a
 *   nativeFormat that doesn't match the channel, a video channel without its three-shot
 *   script; plus asset-name-derivation unit tests for the taxonomy helpers station 8b's
 *   channel cuts are named through; plus one subprocess test proving `machine.mjs
 *   rollout-validate` is a faithful wrapper over the in-process validator
 * [POS]: part of test/, covers station 8b's schema gate and its channel-cut naming lineage,
 *   the same "skill layer is a thin wrapper over src/" contract test/machine.test.ts already
 *   covers for the scripted stations
 * [PROTOCOL]: update this header on change, then check CLAUDE.md
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateRolloutDraft, nativeFormatForChannel } from "../src/stages/rollout.js";
import { channelToken, deriveChannelAssetName } from "../src/taxonomy.js";
import type { RolloutDraft } from "../src/types.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MACHINE_MJS = path.join(REPO_ROOT, "scripts", "machine.mjs");

const postKitFixture = (file: string, caption: string) => ({
  file,
  caption,
  hashtags: ["#reveal", "#familyfirst", "#throwback"],
  altText: "A restored wedding photograph glowing with recovered color against the faded original.",
  postingNote: "Post inside the first 48 hours of the observation window, reply-pin the strongest comment.",
});

const validDraft: RolloutDraft = {
  variantId: "v2",
  name: "WEB_CONV_MOF_EVG_STIL_THEP_THEWOR_FANS_V03",
  participationKit: null,
  channels: [
    {
      channel: "instagram",
      role: "discovery",
      nativeFormat: "ugc-still",
      assetName: "IG_CONV_MOF_EVG_STIL_THEP_THEWOR_FANS_V03",
      assetPath: null,
      coverPath: null,
      videoDurationSec: null,
      illustrativeLabel: null,
      channelCopy: "Swipe closer. New crest, same picture.",
      channelScript: null,
      assetSpec: "Creator aesthetic 1:1 still shot on a phone, the crest visible but unretouched.",
      executionSteps: [
        "Post the reveal in the first 48 hours of the observation window.",
        "Lead the caption with the formula hook.",
        "Track instagram reach against the wave's preregistered thresholds every day.",
      ],
      kpi: "3.5% instagram engagement rate inside the 21 day window",
      kpiThresholdNote: "Matches the plan's preregistered scaleAt of 0.035 for the evergreen angle.",
      postKit: postKitFixture("IG_CONV_MOF_EVG_STIL_THEP_THEWOR_FANS_V03.png", "Swipe closer. New crest, same picture."),
    },
    {
      channel: "tiktok",
      role: "amplification",
      nativeFormat: "video",
      assetName: "TT_CONV_MOF_EVG_STIL_THEP_THEWOR_FANS_V03",
      assetPath: null,
      coverPath: "waves/wave-03/assets/rollout/TT_CONV_MOF_EVG_STIL_THEP_THEWOR_FANS_V03.png",
      videoDurationSec: null,
      illustrativeLabel: null,
      channelCopy: "Wait for it. New crest, same picture.",
      channelScript: [
        "Shot 1 (establish): the untouched profile picture fills the frame, everyday and familiar.",
        "Shot 2 (contrast): the vintage crest paints itself onto the collar corner in one stroke.",
        "Shot 3 (land): hook copy locks in: Wait for it. New crest, same picture. Frame holds, end.",
      ],
      assetSpec: "Native vertical video under 15 seconds, a three shot script plus a 9:16 cover frame.",
      executionSteps: [
        "Ship the tiktok cut inside the first 48 hours of the observation window.",
        "Cross post the same cut from an adjacent account to widen reach.",
        "Track tiktok performance against the wave's preregistered thresholds every day.",
      ],
      kpi: "3.5% tiktok engagement rate inside the 21 day window",
      kpiThresholdNote: "Matches the plan's preregistered scaleAt of 0.035 for the evergreen angle.",
      postKit: postKitFixture("TT_CONV_MOF_EVG_STIL_THEP_THEWOR_FANS_V03.mp4", "Wait for it. New crest, same picture."),
    },
    {
      channel: "x",
      role: "conversion",
      nativeFormat: "still",
      assetName: "XTW_CONV_MOF_EVG_STIL_THEP_THEWOR_FANS_V03",
      assetPath: null,
      coverPath: null,
      videoDurationSec: null,
      illustrativeLabel: null,
      channelCopy: "New drop, same thread. New crest, same picture.",
      channelScript: null,
      assetSpec: "16:9 still posted natively, the copy line carried as the post text.",
      executionSteps: [
        "Post the still natively inside the first 48 hours of the observation window.",
        "Pin a direct link back to the asset for one clear next step.",
        "Track x engagement against the wave's preregistered thresholds every day.",
      ],
      kpi: "3.5% x engagement rate inside the 21 day window",
      kpiThresholdNote: "Matches the plan's preregistered scaleAt of 0.035 for the evergreen angle.",
      postKit: postKitFixture("XTW_CONV_MOF_EVG_STIL_THEP_THEWOR_FANS_V03.png", "New drop, same thread. New crest, same picture."),
    },
  ],
};

test("validateRolloutDraft: accepts a well formed draft with 3 channels", () => {
  const result = validateRolloutDraft(validDraft);
  assert.deepEqual(result, { ok: true });
});

test("validateRolloutDraft: rejects a channel count outside the 3 to 4 range", () => {
  const tooFew: RolloutDraft = { ...validDraft, channels: validDraft.channels.slice(0, 2) };
  const result = validateRolloutDraft(tooFew);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.errors.join(";"), /channels: must have 3 to 4 entries/);
});

test("validateRolloutDraft: rejects an invalid role value", () => {
  const badRole = {
    ...validDraft,
    channels: [{ ...validDraft.channels[0], role: "growth-hacking" }, validDraft.channels[1], validDraft.channels[2]],
  };
  const result = validateRolloutDraft(badRole);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.errors.join(";"), /channels\[0\]\.role: must be one of/);
});

test("validateRolloutDraft: rejects an em dash or en dash inside a sentence field", () => {
  const withDash = {
    ...validDraft,
    channels: [
      { ...validDraft.channels[0], assetSpec: "Square crop — the crest framed as the focal point." },
      validDraft.channels[1],
      validDraft.channels[2],
    ],
  };
  const result = validateRolloutDraft(withDash);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.errors.join(";"), /channels\[0\]\.assetSpec: contains an em dash or en dash/);
});

test("validateRolloutDraft: rejects an assetName whose CHANNEL segment does not match channel", () => {
  const mismatched = {
    ...validDraft,
    channels: [
      { ...validDraft.channels[0], assetName: "TT_CONV_MOF_EVG_STIL_THEP_THEWOR_FANS_V03" }, // instagram channel, tiktok token
      validDraft.channels[1],
      validDraft.channels[2],
    ],
  };
  const result = validateRolloutDraft(mismatched);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.errors.join(";"), /channels\[0\]\.assetName: CHANNEL segment "TT" does not match channel "instagram" \(expected "IG"\)/);
});

test("validateRolloutDraft: rejects an assetName that is not nine segments", () => {
  const tooFewSegments = {
    ...validDraft,
    channels: [{ ...validDraft.channels[0], assetName: "IG_CONV_MOF" }, validDraft.channels[1], validDraft.channels[2]],
  };
  const result = validateRolloutDraft(tooFewSegments);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.errors.join(";"), /channels\[0\]\.assetName: must have 9 underscore separated segments, got 3/);
});

test("validateRolloutDraft: rejects a missing channelCopy", () => {
  const noCopy = {
    ...validDraft,
    channels: [{ ...validDraft.channels[0], channelCopy: "" }, validDraft.channels[1], validDraft.channels[2]],
  };
  const result = validateRolloutDraft(noCopy);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.errors.join(";"), /channels\[0\]\.channelCopy: missing or not a string/);
});

test("validateRolloutDraft: rejects a nativeFormat that does not match the channel", () => {
  const mismatched = {
    ...validDraft,
    channels: [{ ...validDraft.channels[0], nativeFormat: "video" }, validDraft.channels[1], validDraft.channels[2]],
  };
  const result = validateRolloutDraft(mismatched);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.errors.join(";"), /channels\[0\]\.nativeFormat: "video" does not match channel "instagram" \(expected "ugc-still"\)/);
});

test("validateRolloutDraft: rejects a video channel without its three-shot script", () => {
  const noScript = {
    ...validDraft,
    channels: [validDraft.channels[0], { ...validDraft.channels[1], channelScript: null }, validDraft.channels[2]],
  };
  const result = validateRolloutDraft(noScript);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.errors.join(";"), /channels\[1\]\.channelScript: a video channel must carry a three-shot script/);
});

test("validateRolloutDraft: rejects a channelScript on a non-video channel", () => {
  const strayScript = {
    ...validDraft,
    channels: [{ ...validDraft.channels[0], channelScript: ["only shot"] }, validDraft.channels[1], validDraft.channels[2]],
  };
  const result = validateRolloutDraft(strayScript);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.errors.join(";"), /channels\[0\]\.channelScript: must be null for a non-video channel/);
});

test("nativeFormatForChannel: format follows the channel, unlisted channels default to still", () => {
  assert.equal(nativeFormatForChannel("tiktok"), "video");
  assert.equal(nativeFormatForChannel("instagram"), "ugc-still");
  assert.equal(nativeFormatForChannel("x"), "still");
  assert.equal(nativeFormatForChannel("in-app profile surface"), "surface");
  assert.equal(nativeFormatForChannel("youtube shorts"), "still");
});

test("validateRolloutDraft: accepts a null assetPath (generation not yet run, or unavailable)", () => {
  const nullPath = {
    ...validDraft,
    channels: [{ ...validDraft.channels[0], assetPath: null }, validDraft.channels[1], validDraft.channels[2]],
  };
  const result = validateRolloutDraft(nullPath);
  assert.deepEqual(result, { ok: true });
});

test("scripts/machine.mjs (real subprocess): `rollout-validate` matches validateRolloutDraft in-process", () => {
  const result = spawnSync("node", [MACHINE_MJS, "rollout-validate"], {
    input: JSON.stringify(validDraft),
    encoding: "utf-8",
    cwd: REPO_ROOT,
  });

  assert.equal(result.status, 0, `subprocess failed: ${result.stderr}`);
  const parsed = JSON.parse(result.stdout);
  assert.deepEqual(parsed, validateRolloutDraft(validDraft));
});

// ============================================================
// channelToken / deriveChannelAssetName: the CHANNEL-segment swap that
// registers a channel cut as its own expansion arm off the winning concept.
// ============================================================
test("channelToken: known channels resolve to their dictionary token", () => {
  assert.equal(channelToken("instagram"), "IG");
  assert.equal(channelToken("tiktok"), "TT");
  assert.equal(channelToken("x"), "XTW");
  assert.equal(channelToken("in-app profile surface"), "APP");
});

test("channelToken: is case and whitespace insensitive", () => {
  assert.equal(channelToken(" Instagram "), "IG");
  assert.equal(channelToken("TIKTOK"), "TT");
});

test("channelToken: falls back to a slugged 3-char code for an unlisted channel", () => {
  assert.equal(channelToken("youtube shorts"), "YOU");
});

test("deriveChannelAssetName: swaps only the CHANNEL segment, the other eight are inherited verbatim", () => {
  const base = "WEB_CONV_MOF_EVG_STIL_THEP_THEWOR_FANS_V03";
  const derived = deriveChannelAssetName(base, "tiktok");
  assert.equal(derived, "TT_CONV_MOF_EVG_STIL_THEP_THEWOR_FANS_V03");
  assert.deepEqual(derived.split("_").slice(1), base.split("_").slice(1));
});

// ============================================================
// postKit / participationKit: the real per-channel deliverable and the
// ugc-loop concept's real "how real users participate" mechanism, added
// when "video channel" stopped meaning a cover frame and a script and
// "ugc-loop concept" stopped meaning a faked UGC image.
// ============================================================
test("validateRolloutDraft: rejects a channel missing postKit", () => {
  const withoutPostKit = { ...validDraft.channels[0], postKit: undefined };
  const result = validateRolloutDraft({
    ...validDraft,
    channels: [withoutPostKit, validDraft.channels[1], validDraft.channels[2]],
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.errors.join(";"), /channels\[0\]\.postKit: missing or not an object/);
});

test("validateRolloutDraft: rejects a postKit with hashtags outside the 3 to 6 range", () => {
  const result = validateRolloutDraft({
    ...validDraft,
    channels: [
      { ...validDraft.channels[0], postKit: { ...validDraft.channels[0].postKit, hashtags: ["#one"] } },
      validDraft.channels[1],
      validDraft.channels[2],
    ],
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.errors.join(";"), /channels\[0\]\.postKit\.hashtags: must have 3 to 6 entries/);
});

test("validateRolloutDraft: rejects a video channel missing coverPath", () => {
  const result = validateRolloutDraft({
    ...validDraft,
    channels: [validDraft.channels[0], { ...validDraft.channels[1], coverPath: null }, validDraft.channels[2]],
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.errors.join(";"), /channels\[1\]\.coverPath: a video channel must carry a no-text cover frame path/);
});

test("validateRolloutDraft: rejects a non-video channel carrying a coverPath", () => {
  const result = validateRolloutDraft({
    ...validDraft,
    channels: [{ ...validDraft.channels[0], coverPath: "some/path.png" }, validDraft.channels[1], validDraft.channels[2]],
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.errors.join(";"), /channels\[0\]\.coverPath: must be null for a non-video channel/);
});

test("validateRolloutDraft: rejects a video channel with a rendered assetPath but no videoDurationSec", () => {
  const result = validateRolloutDraft({
    ...validDraft,
    channels: [
      validDraft.channels[0],
      { ...validDraft.channels[1], assetPath: "waves/wave-03/assets/rollout/TT_..._V03.mp4" },
      validDraft.channels[2],
    ],
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.errors.join(";"), /channels\[1\]\.videoDurationSec: must be a positive number once assetPath holds a rendered mp4/);
});

test("validateRolloutDraft: accepts a null participationKit (non ugc-loop concept)", () => {
  const result = validateRolloutDraft(validDraft);
  assert.deepEqual(result, { ok: true });
});

test("validateRolloutDraft: accepts a well formed participationKit", () => {
  const withKit = {
    ...validDraft,
    participationKit: {
      mechanic: "Recreate the pose at home and post it with the credit tag pointed at the couple you copied.",
      creatorShotList: [
        "Cold open already mid-pose, no setup shot.",
        "One clear beat held on the exact match, phone handheld, real room light.",
        "Whip to whoever is laughing off camera, unscripted.",
        "Land on the credit tag or a spoken shoutout.",
      ],
      seedCaptions: [
        "We tried the pose everyone is talking about. No regrets.",
        "Recreating the wedding photo of the year in our kitchen.",
        "Tagged the couple who did it before us. Your turn next.",
      ],
      creditRule: "Every recreation must tag the couple whose version it copied before it can seed the next one.",
    },
  };
  const result = validateRolloutDraft(withKit);
  assert.deepEqual(result, { ok: true });
});

test("validateRolloutDraft: rejects a participationKit with an em dash inside mechanic", () => {
  const withKit = {
    ...validDraft,
    participationKit: {
      mechanic: "Recreate the pose at home — post it with the credit tag.",
      creatorShotList: ["shot one", "shot two", "shot three"],
      seedCaptions: ["caption one", "caption two", "caption three"],
      creditRule: "Every recreation must tag the previous couple.",
    },
  };
  const result = validateRolloutDraft(withKit);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.errors.join(";"), /participationKit\.mechanic: contains an em dash or en dash/);
});

test("validateRolloutDraft: rejects a participationKit with the wrong seedCaptions count", () => {
  const withKit = {
    ...validDraft,
    participationKit: {
      mechanic: "Recreate the pose at home and post it with the credit tag.",
      creatorShotList: ["shot one", "shot two", "shot three"],
      seedCaptions: ["only one caption"],
      creditRule: "Every recreation must tag the previous couple.",
    },
  };
  const result = validateRolloutDraft(withKit);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.errors.join(";"), /participationKit\.seedCaptions: must have exactly 3 entries/);
});

test("deriveChannelAssetName: different channels on the same base name produce different assetNames", () => {
  const base = "WEB_CONV_MOF_EVG_STIL_THEP_THEWOR_FANS_V03";
  const ig = deriveChannelAssetName(base, "instagram");
  const x = deriveChannelAssetName(base, "x");
  assert.notEqual(ig, x);
  assert.equal(ig.split("_")[0], "IG");
  assert.equal(x.split("_")[0], "XTW");
});
