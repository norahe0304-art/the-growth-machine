/**
 * [INPUT]: depends on node:test/node:assert, on src/stages/naming.ts's runNaming
 * [OUTPUT]: unit tests for the naming station's determinism
 * [POS]: part of test/, covers the "same input, always the same output" rule
 * [PROTOCOL]: update this header on change, then check CLAUDE.md
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

test("naming: same input produces the same name (deterministic)", () => {
  const a = runNaming({ variant, format: "still", moment: "world cup final", audience: "football fans", version: 1 });
  const b = runNaming({ variant, format: "still", moment: "world cup final", audience: "football fans", version: 1 });
  assert.equal(a.name, b.name);
});

test("naming: nine-segment structure has the right number of segments", () => {
  const named = runNaming({ variant, format: "still", moment: "world cup final", audience: "football fans", version: 1 });
  const segs = named.name.split("_");
  assert.equal(segs.length, 9, `expected 9 segments, got ${segs.length}: ${named.name}`);
});

test("naming: different format produces a different name", () => {
  const still = runNaming({ variant, format: "still", moment: "world cup final", audience: "football fans", version: 1 });
  const motion = runNaming({ variant, format: "motion", moment: "world cup final", audience: "football fans", version: 1 });
  assert.notEqual(still.name, motion.name);
});

test("naming: version segment is zero-padded correctly", () => {
  const v1 = runNaming({ variant, format: "still", moment: "world cup final", audience: "football fans", version: 1 });
  const v12 = runNaming({ variant, format: "still", moment: "world cup final", audience: "football fans", version: 12 });
  assert.ok(v1.name.endsWith("_V01"));
  assert.ok(v12.name.endsWith("_V12"));
});
