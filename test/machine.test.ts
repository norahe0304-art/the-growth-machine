/**
 * [INPUT]: depends on node:test/node:assert, node:child_process, node:path, node:url, on
 *   scripts/machine-impl.ts's exported stage functions, on src/stages/naming.js|simulate.js|
 *   decide.js|plan.js for the direct-path comparison
 * [OUTPUT]: smoke tests proving scripts/machine.mjs (the skill layer's scripted-station entry
 *   point) produces byte-identical output to calling the src/ stages directly, both in-process
 *   and as a real subprocess
 * [POS]: part of test/, covers the "skill layer is a thin, faithful wrapper over src/" contract —
 *   the whole point of Lane 25's CLI-to-skill conversion is that nothing about the pipeline's
 *   actual behavior changes, only how it gets invoked
 * [PROTOCOL]: update this header on change, then check CLAUDE.md
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { nameStage, simulateStage, decideStage } from "../scripts/machine-impl.js";
import { runNaming } from "../src/stages/naming.js";
import { runSimulate } from "../src/stages/simulate.js";
import { runDecide } from "../src/stages/decide.js";
import { PRE_REGISTERED_THRESHOLDS, ENGAGEMENT_THRESHOLDS } from "../src/stages/plan.js";
import type { NamedAsset, Plan, SimulatedCurve, Variant } from "../src/types.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MACHINE_MJS = path.join(REPO_ROOT, "scripts", "machine.mjs");

const variant: Variant = {
  id: "v1",
  asset: "a mug",
  assetKind: "thing",
  newElement: "steam shaped like a wave",
  angle: "everyday mug meets big wave",
  angleType: "moment",
  workingTitle: "Mug Wave",
};

const plan: Plan = {
  moment: "smoke test moment",
  waveNumber: 9,
  arms: [],
  preRegisteredThresholds: PRE_REGISTERED_THRESHOLDS,
  engagementThresholds: ENGAGEMENT_THRESHOLDS,
  dates: { start: "2026-01-01", end: "2026-01-21", days: 21 },
  rationale: "smoke test plan",
};

test("machine-impl: nameStage produces the same NamedAsset[] as calling runNaming directly", () => {
  const viaStage = nameStage({
    moment: "smoke test moment",
    waveNumber: 9,
    variants: [variant],
    audienceByVariant: { v1: "coffee people" },
  });

  const expectedStill = runNaming({ variant, format: "still", moment: "smoke test moment", audience: "coffee people", version: 9 });
  const expectedMotion = runNaming({ variant, format: "motion", moment: "smoke test moment", audience: "coffee people", version: 9 });

  assert.equal(viaStage.length, 2);
  assert.deepEqual(viaStage[0], expectedStill);
  assert.deepEqual(viaStage[1], expectedMotion);
});

test("machine-impl: simulateStage + decideStage match runSimulate/runDecide directly (still-only, motion excluded)", () => {
  const named: NamedAsset[] = [
    { variantId: "v1", format: "still", name: "WEB_CONV_TOF_HOT_STIL_TEST_SMOKET_COFF_V09", segments: {} },
    { variantId: "v1", format: "motion", name: "WEB_CONV_TOF_HOT_MOTN_TEST_SMOKET_COFF_V09", segments: {} },
  ];

  const simulated = simulateStage({ namedAssets: named, variants: [variant], days: 21, waveNumber: 9 });
  assert.equal(simulated.length, 1, "motion assets must not enter the simulated curve");

  const expectedCurve: SimulatedCurve = runSimulate(named[0], variant.angleType, 21, 9);
  assert.deepEqual(simulated[0], expectedCurve);

  const decided = decideStage({ simulated, plan });
  const expectedDecision = runDecide(expectedCurve, plan);
  assert.deepEqual(decided[0], expectedDecision);
});

test("scripts/machine.mjs (real subprocess): `name` stdin-JSON-in/stdout-JSON-out matches nameStage in-process", () => {
  const input = {
    moment: "smoke test moment",
    waveNumber: 9,
    variants: [variant],
    audienceByVariant: { v1: "coffee people" },
  };

  const result = spawnSync("node", [MACHINE_MJS, "name"], {
    input: JSON.stringify(input),
    encoding: "utf-8",
    cwd: REPO_ROOT,
  });

  assert.equal(result.status, 0, `subprocess failed: ${result.stderr}`);
  const parsed = JSON.parse(result.stdout);
  assert.deepEqual(parsed, nameStage(input));
});

test("scripts/machine.mjs (real subprocess): unknown stage exits non-zero with usage on stderr", () => {
  const result = spawnSync("node", [MACHINE_MJS, "not-a-real-stage"], {
    encoding: "utf-8",
    cwd: REPO_ROOT,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /usage: machine\.mjs/);
});
