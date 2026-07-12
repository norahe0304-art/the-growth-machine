/**
 * [INPUT]: 依赖 node:test/node:assert，依赖 src/stages/naming.ts 的 runNaming
 * [OUTPUT]: 对外提供 naming 站的确定性单测
 * [POS]: test/ 的一员，覆盖"同输入永远同输出"这一条铁律
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from "node:test";
import assert from "node:assert/strict";
import { runNaming } from "../src/stages/naming.js";
import type { Variant } from "../src/types.js";

const variant: Variant = {
  id: "v1",
  asset: "a coffee cup",
  assetKind: "thing",
  newElement: "a stadium roar",
  angle: "everyday object meets big moment",
  angleType: "moment",
  workingTitle: "cup roar",
};

test("naming: 同输入产出同名字(确定性)", () => {
  const a = runNaming({ variant, format: "still", moment: "world cup final", audience: "football fans", version: 1 });
  const b = runNaming({ variant, format: "still", moment: "world cup final", audience: "football fans", version: 1 });
  assert.equal(a.name, b.name);
});

test("naming: 九段结构完整，段数正确", () => {
  const named = runNaming({ variant, format: "still", moment: "world cup final", audience: "football fans", version: 1 });
  const segs = named.name.split("_");
  assert.equal(segs.length, 9, `期望 9 段，实际 ${segs.length} 段: ${named.name}`);
});

test("naming: format 不同产出不同名字", () => {
  const still = runNaming({ variant, format: "still", moment: "world cup final", audience: "football fans", version: 1 });
  const motion = runNaming({ variant, format: "motion", moment: "world cup final", audience: "football fans", version: 1 });
  assert.notEqual(still.name, motion.name);
});

test("naming: version 段正确补零", () => {
  const v1 = runNaming({ variant, format: "still", moment: "world cup final", audience: "football fans", version: 1 });
  const v12 = runNaming({ variant, format: "still", moment: "world cup final", audience: "football fans", version: 12 });
  assert.ok(v1.name.endsWith("_V01"));
  assert.ok(v12.name.endsWith("_V12"));
});
