/**
 * [INPUT]: depends on node:test/node:assert, on src/stages/simulate.ts's runSimulate
 * [OUTPUT]: unit tests for the simulate station's reproducibility
 * [POS]: part of test/, covers the "seed = hash(asset name), reproducible" rule
 * [PROTOCOL]: update this header on change, then check CLAUDE.md
 */
import test from "node:test";
import assert from "node:assert/strict";
import { runSimulate } from "../src/stages/simulate.js";
import type { NamedAsset } from "../src/types.js";

const named: NamedAsset = {
  variantId: "v1",
  format: "still",
  name: "WEB_CONV_TOF_HOT_STIL_TEST_MOMENT_PERS_V01",
  segments: {},
};

test("simulate: same asset name + angleType + wave -> identical curve (reproducible)", () => {
  const a = runSimulate(named, "moment", 21, 1);
  const b = runSimulate(named, "moment", 21, 1);
  assert.deepEqual(a.predictedCTR, b.predictedCTR);
  assert.deepEqual(a.shareRate, b.shareRate);
  assert.equal(a.seed, b.seed);
});

test("simulate: curve length equals days", () => {
  const curve = runSimulate(named, "evergreen", 21, 1);
  assert.equal(curve.predictedCTR.length, 21);
  assert.equal(curve.shareRate.length, 21);
});

test("simulate: the three angleTypes produce different curves", () => {
  const moment = runSimulate(named, "moment", 21, 1);
  const evergreen = runSimulate(named, "evergreen", 21, 1);
  const ugc = runSimulate(named, "ugc-loop", 21, 1);
  assert.notDeepEqual(moment.predictedCTR, evergreen.predictedCTR);
  assert.notDeepEqual(evergreen.predictedCTR, ugc.predictedCTR);
});

test("simulate: ugc-loop curve rises with waveNumber (wave-over-wave compounding)", () => {
  const wave1 = runSimulate(named, "ugc-loop", 21, 1);
  const wave5 = runSimulate(named, "ugc-loop", 21, 5);
  const lastDay1 = wave1.predictedCTR[wave1.predictedCTR.length - 1];
  const lastDay5 = wave5.predictedCTR[wave5.predictedCTR.length - 1];
  assert.ok(lastDay5 > lastDay1, `wave5's last-day CTR (${lastDay5}) should exceed wave1's (${lastDay1})`);
});

test("simulate: all values fall within [0,1]", () => {
  const curve = runSimulate(named, "moment", 21, 3);
  for (const v of [...curve.predictedCTR, ...curve.shareRate]) {
    assert.ok(v >= 0 && v <= 1, `value out of range: ${v}`);
  }
});
