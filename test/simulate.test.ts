/**
 * [INPUT]: 依赖 node:test/node:assert，依赖 src/stages/simulate.ts 的 runSimulate
 * [OUTPUT]: 对外提供 simulate 站的可复现性单测
 * [POS]: test/ 的一员，覆盖"seed = 资产名 hash，可复现"这一条铁律
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
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

test("simulate: 同资产名同角度同波次 -> 曲线完全一致(可复现)", () => {
  const a = runSimulate(named, "moment", 21, 1);
  const b = runSimulate(named, "moment", 21, 1);
  assert.deepEqual(a.predictedCTR, b.predictedCTR);
  assert.deepEqual(a.shareRate, b.shareRate);
  assert.equal(a.seed, b.seed);
});

test("simulate: 曲线长度等于 days", () => {
  const curve = runSimulate(named, "evergreen", 21, 1);
  assert.equal(curve.predictedCTR.length, 21);
  assert.equal(curve.shareRate.length, 21);
});

test("simulate: 三种 angleType 产出不同曲线", () => {
  const moment = runSimulate(named, "moment", 21, 1);
  const evergreen = runSimulate(named, "evergreen", 21, 1);
  const ugc = runSimulate(named, "ugc-loop", 21, 1);
  assert.notDeepEqual(moment.predictedCTR, evergreen.predictedCTR);
  assert.notDeepEqual(evergreen.predictedCTR, ugc.predictedCTR);
});

test("simulate: ugc-loop 曲线随 waveNumber 增大而抬升(逐波复利)", () => {
  const wave1 = runSimulate(named, "ugc-loop", 21, 1);
  const wave5 = runSimulate(named, "ugc-loop", 21, 5);
  const lastDay1 = wave1.predictedCTR[wave1.predictedCTR.length - 1];
  const lastDay5 = wave5.predictedCTR[wave5.predictedCTR.length - 1];
  assert.ok(lastDay5 > lastDay1, `wave5末日CTR(${lastDay5})应高于wave1末日CTR(${lastDay1})`);
});

test("simulate: 所有值落在 [0,1] 区间", () => {
  const curve = runSimulate(named, "moment", 21, 3);
  for (const v of [...curve.predictedCTR, ...curve.shareRate]) {
    assert.ok(v >= 0 && v <= 1, `值越界: ${v}`);
  }
});
