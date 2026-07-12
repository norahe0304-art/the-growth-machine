/**
 * [INPUT]: depends on node:test/node:assert, on src/stages/measure.ts's computeEngagementRate/normalizeInputEntry/mergeReadings, on src/stages/decide.ts's runDecideMeasured
 * [OUTPUT]: unit tests for the measure station — engagementRate normalization, reading merge/de-dupe, and the measured decide path
 * [POS]: part of test/, covers "the simulator becomes an instrument": real channel numbers turn into a comparable rate and a rules-driven verdict
 * [PROTOCOL]: update this header on change, then check CLAUDE.md
 */
import test from "node:test";
import assert from "node:assert/strict";
import { computeEngagementRate, normalizeInputEntry, mergeReadings } from "../src/stages/measure.js";
import { runDecideMeasured } from "../src/stages/decide.js";
import type { MeasuredAssetSummary, MeasuredInputEntry, MeasuredReading, PreRegisteredThresholds } from "../src/types.js";

test("measure: computeEngagementRate normalizes (likes+comments+shares+saves)/impressions", () => {
  const rate = computeEngagementRate({
    channel: "xiaohongshu",
    impressions: 1000,
    likes: 50,
    comments: 10,
    shares: 20,
    saves: 20,
  });
  assert.ok(Math.abs(rate - 0.1) < 1e-9, `expected 0.1, got ${rate}`);
});

test("measure: computeEngagementRate returns 0 when impressions <= 0 (never divides by zero)", () => {
  const rate = computeEngagementRate({ channel: "x", impressions: 0, likes: 5, comments: 0, shares: 0, saves: 0 });
  assert.equal(rate, 0);
});

test("measure: normalizeInputEntry rejects impressions <= 0", () => {
  const entry: MeasuredInputEntry = {
    assetName: "TEST_ASSET",
    channel: "linkedin",
    impressions: 0,
    likes: 1,
    comments: 0,
    shares: 0,
    saves: 0,
  };
  assert.throws(() => normalizeInputEntry(entry, 1));
});

test("measure: normalizeInputEntry falls back to the default day when day is omitted", () => {
  const entry: MeasuredInputEntry = {
    assetName: "TEST_ASSET",
    channel: "linkedin",
    impressions: 500,
    likes: 10,
    comments: 2,
    shares: 3,
    saves: 5,
  };
  const { reading } = normalizeInputEntry(entry, 7);
  assert.equal(reading.day, 7);
  assert.ok(Math.abs(reading.engagementRate - 20 / 500) < 1e-9);
});

test("measure: mergeReadings de-dupes same-day readings (a re-measure overwrites, not duplicates)", () => {
  const existing: MeasuredReading[] = [
    { day: 3, engagementRate: 0.05, metrics: { channel: "x", impressions: 100, likes: 3, comments: 1, shares: 1, saves: 0 } },
  ];
  const incoming: MeasuredReading[] = [
    { day: 3, engagementRate: 0.09, metrics: { channel: "x", impressions: 100, likes: 6, comments: 1, shares: 1, saves: 1 } },
    { day: 10, engagementRate: 0.12, metrics: { channel: "x", impressions: 200, likes: 15, comments: 3, shares: 3, saves: 3 } },
  ];
  const merged = mergeReadings(existing, incoming);
  assert.equal(merged.length, 2, "day 3 should be overwritten, not duplicated");
  assert.equal(merged[0].day, 3);
  assert.ok(Math.abs(merged[0].engagementRate - 0.09) < 1e-9, "day 3 should hold the newer reading");
  assert.equal(merged[1].day, 10);
});

test("measure: mergeReadings keeps the series sorted ascending by day", () => {
  const merged = mergeReadings(
    [{ day: 14, engagementRate: 0.1, metrics: { channel: "x", impressions: 1, likes: 0, comments: 0, shares: 0, saves: 0 } }],
    [{ day: 3, engagementRate: 0.05, metrics: { channel: "x", impressions: 1, likes: 0, comments: 0, shares: 0, saves: 0 } }]
  );
  assert.deepEqual(merged.map((r) => r.day), [3, 14]);
});

const engagementThresholds: PreRegisteredThresholds = { scaleAt: 0.08, killAt: 0.02, fatigueSlope: -0.01 };

function summaryWith(readings: MeasuredReading[]): MeasuredAssetSummary {
  return {
    assetName: "TEST_ASSET",
    variantId: "v1",
    format: "still",
    channel: "x",
    readings,
    engagementRate: readings[readings.length - 1]?.engagementRate ?? 0,
  };
}

test("measure: runDecideMeasured scales when the latest engagementRate clears scaleAt", () => {
  const summary = summaryWith([
    { day: 3, engagementRate: 0.09, metrics: { channel: "x", impressions: 100, likes: 9, comments: 0, shares: 0, saves: 0 } },
  ]);
  const decision = runDecideMeasured(summary, engagementThresholds);
  assert.equal(decision.verdict, "SCALE");
  assert.equal(decision.source, "measured");
});

test("measure: runDecideMeasured kills when the latest engagementRate falls under killAt", () => {
  const summary = summaryWith([
    { day: 3, engagementRate: 0.01, metrics: { channel: "x", impressions: 100, likes: 1, comments: 0, shares: 0, saves: 0 } },
  ]);
  const decision = runDecideMeasured(summary, engagementThresholds);
  assert.equal(decision.verdict, "KILL");
});

test("measure: runDecideMeasured with a single reading never fires the fatigue path (no slope yet)", () => {
  // a lone reading in the middle band must land on ITERATE, not a spurious KILL from an undefined slope
  const summary = summaryWith([
    { day: 3, engagementRate: 0.05, metrics: { channel: "x", impressions: 100, likes: 5, comments: 0, shares: 0, saves: 0 } },
  ]);
  const decision = runDecideMeasured(summary, engagementThresholds);
  assert.equal(decision.verdict, "ITERATE");
});
