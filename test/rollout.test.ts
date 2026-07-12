/**
 * [INPUT]: depends on node:test/node:assert, node:child_process, node:path, node:url, on
 *   src/stages/rollout.ts's validateRolloutDraft, on scripts/machine.mjs as a real subprocess
 * [OUTPUT]: unit tests proving validateRolloutDraft accepts a well-formed RolloutDraft and
 *   rejects the specific ways a hand-authored one can go wrong: bad channel count, bad role,
 *   an em or en dash slipped into a sentence field; plus one subprocess test proving
 *   `machine.mjs rollout-validate` is a faithful wrapper over the in-process validator
 * [POS]: part of test/, covers station 8b's schema gate, the same "skill layer is a thin
 *   wrapper over src/" contract test/machine.test.ts already covers for the scripted stations
 * [PROTOCOL]: update this header on change, then check CLAUDE.md
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateRolloutDraft } from "../src/stages/rollout.js";
import type { RolloutDraft } from "../src/types.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MACHINE_MJS = path.join(REPO_ROOT, "scripts", "machine.mjs");

const validDraft: RolloutDraft = {
  variantId: "v2",
  name: "WEB_CONV_MOF_EVG_STIL_THEP_THEWOR_FANS_V03",
  channels: [
    {
      channel: "instagram",
      role: "discovery",
      assetSpec: "Square 1:1 feed crop, the crest graft framed as the thumbnail focal point.",
      executionSteps: [
        "Post the reveal in the first 48 hours of the observation window.",
        "Lead the caption with the formula hook.",
        "Track instagram reach against the wave's preregistered thresholds every day.",
      ],
      kpi: "3.5% instagram engagement rate inside the 21 day window",
      kpiThresholdNote: "Matches the plan's preregistered scaleAt of 0.035 for the evergreen angle.",
    },
    {
      channel: "tiktok",
      role: "amplification",
      assetSpec: "Vertical 9:16 cut under 15 seconds, the hook restated as on screen text.",
      executionSteps: [
        "Ship the tiktok cut inside the first 48 hours of the observation window.",
        "Cross post the same cut from an adjacent account to widen reach.",
        "Track tiktok performance against the wave's preregistered thresholds every day.",
      ],
      kpi: "3.5% tiktok engagement rate inside the 21 day window",
      kpiThresholdNote: "Matches the plan's preregistered scaleAt of 0.035 for the evergreen angle.",
    },
    {
      channel: "x",
      role: "conversion",
      assetSpec: "16:9 still posted natively, the copy line carried as the post text.",
      executionSteps: [
        "Post the still natively inside the first 48 hours of the observation window.",
        "Pin a direct link back to the asset for one clear next step.",
        "Track x engagement against the wave's preregistered thresholds every day.",
      ],
      kpi: "3.5% x engagement rate inside the 21 day window",
      kpiThresholdNote: "Matches the plan's preregistered scaleAt of 0.035 for the evergreen angle.",
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
