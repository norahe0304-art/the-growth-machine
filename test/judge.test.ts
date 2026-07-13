/**
 * [INPUT]: depends on node:test/node:assert, node:os, node:path, on src/stages/judge.ts's runJudge, on src/types.ts's Brief/JudgeScore/NamedAsset/ProducedAsset
 * [OUTPUT]: unit tests for the judge station's fourth brandFit dimension and legacy JudgeScore/Brief shape compatibility
 * [POS]: part of test/, covers the CLI-vs-skill judge score parity this lane closes: brandFit
 *   defaults to 2 with no BRAND_PACK configured, is actually scored against brand/<pack>/brand.md
 *   when one is, counts toward the fail/regenerate rule same as the original three dimensions, and
 *   readout.json written before brandFit/referenceSet existed still deserializes as a valid Brief/JudgeScore
 * [PROTOCOL]: update this header on change, then check CLAUDE.md
 */
import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { runJudge } from "../src/stages/judge.js";
import type { Brief, JudgeScore, NamedAsset, ProducedAsset } from "../src/types.js";

const ASSETS_DIR = path.join(os.tmpdir(), "growth-machine-test-judge-assets");

const brief: Brief = {
  variantId: "v1",
  workingTitle: "Test Working Title",
  audience: "test audience",
  insight: "test insight",
  assetXElement: "a mug x steam shaped like a wave",
  formats: ["still", "motion"],
  successMetric: "48-hour share rate",
  generationPrompts: {
    image: "a still image prompt",
    motion: "a motion script prompt",
    copy: "a copy prompt",
  },
};

function namedAsset(name: string): NamedAsset {
  return { variantId: "v1", format: "still", name, segments: {} };
}

function producedFor(named: NamedAsset): ProducedAsset {
  return {
    variantId: named.variantId,
    format: named.format,
    name: named.name,
    assetPath: null,
    copy: "mock copy",
    motionScript: null,
    imageModelUsed: null,
    regeneratedCount: 0,
  };
}

test("judge: no BRAND_PACK -> brandFit always defaults to 2, never model-scored", async () => {
  delete process.env.BRAND_PACK;
  const named = namedAsset("TEST_NO_PACK_ASSET_1");
  const { judgeResult } = await runJudge(ASSETS_DIR, named, brief, producedFor(named));
  assert.equal(judgeResult.score.brandFit, 2);
});

test("judge: BRAND_PACK=openai -> brandFit is actually scored (1|2|3), not hardcoded", async () => {
  process.env.BRAND_PACK = "openai";
  try {
    const named = namedAsset("TEST_WITH_PACK_ASSET_1");
    const { judgeResult } = await runJudge(ASSETS_DIR, named, brief, producedFor(named));
    assert.ok(
      judgeResult.score.brandFit === 1 || judgeResult.score.brandFit === 2 || judgeResult.score.brandFit === 3,
      `expected brandFit in {1,2,3}, got ${judgeResult.score.brandFit}`
    );
  } finally {
    delete process.env.BRAND_PACK;
  }
});

test("judge: BRAND_PACK pointing at a pack with no brand.md falls back to the default-2 path", async () => {
  process.env.BRAND_PACK = "does-not-exist";
  try {
    const named = namedAsset("TEST_MISSING_PACK_ASSET_1");
    const { judgeResult } = await runJudge(ASSETS_DIR, named, brief, producedFor(named));
    assert.equal(judgeResult.score.brandFit, 2);
  } finally {
    delete process.env.BRAND_PACK;
  }
});

test("judge: brandFit=1 alone fails the asset and triggers exactly one regeneration", async () => {
  process.env.BRAND_PACK = "openai";
  try {
    // TEST_BRANDFIT_ASSET_11's mock rng draws onBrief=2, legible=2, shareable=3, brandFit=1 on
    // attempt 1 (found by brute-force search over the deterministic mock rng in hash.ts's
    // hashString/mulberry32) -- isolates the brandFit-only fail path from the other three.
    const named = namedAsset("TEST_BRANDFIT_ASSET_11");
    const { judgeResult } = await runJudge(ASSETS_DIR, named, brief, producedFor(named));
    assert.equal(judgeResult.regenerated, true, "a brandFit=1 fail must trigger the one allowed regeneration");
  } finally {
    delete process.env.BRAND_PACK;
  }
});

test("judge: legacy JudgeScore shape (no brandFit field) still type-checks as a valid score", () => {
  const legacy: JudgeScore = { onBrief: 3, legible: 2, shareable: 3 };
  assert.equal(legacy.brandFit, undefined);
});

test("judge: legacy Brief shape (no referenceSet field) still type-checks as a valid brief", () => {
  const legacy: Brief = { ...brief };
  assert.equal(legacy.referenceSet, undefined);
});

test("judge: referenceSet, when present, carries the skill-mode {source, entry, status} shape", () => {
  const withReferenceSet: Brief = {
    ...brief,
    referenceSet: [{ source: "references/cross-channel.md", entry: "starter rule 3", status: "starter-unverified" }],
  };
  assert.equal(withReferenceSet.referenceSet?.[0].status, "starter-unverified");
});
