/**
 * [INPUT]: depends on lib/fs-utils's appendJSONL/readJSONL/writeJSONL/LIBRARY_PATH, on types.ts's LearningEntry/Decision/Variant/NamedAsset
 * [OUTPUT]: exports runLearn(...) -> LearningEntry (appended to library.jsonl), updateLibraryEntry(...) (rewrites one wave's entry, used by measure), getInjectedLearnings() -> string|null
 * [POS]: station 9 of the nine-station pipeline, where "real evolution" happens: this wave's winning traits get committed and injected into the next wave's insight/brief prompts
 * [PROTOCOL]: update this header on change, then check CLAUDE.md
 */
import { appendJSONL, readJSONL, writeJSONL, LIBRARY_PATH } from "../lib/fs-utils.js";
import type { Decision, DecisionSource, LearningEntry, NamedAsset, Variant } from "../types.js";

interface WinnerTrait {
  assetName: string;
  trait: string;
  source: DecisionSource;
}

function extractTraits(winners: Decision[], variants: Variant[], namedAssets: NamedAsset[]): WinnerTrait[] {
  const traits: WinnerTrait[] = [];
  for (const win of winners) {
    const na = namedAssets.find((n) => n.variantId === win.variantId && n.format === win.format);
    const variant = variants.find((v) => v.id === win.variantId);
    if (!variant || !na) continue;
    traits.push({
      assetName: na.name,
      trait: `${variant.assetKind} asset "${variant.asset}" + angleType=${variant.angleType} + HOOK=${na.segments.HOOK}`,
      source: win.source,
    });
  }
  // measured winners carry more weight than simulated ones: real data goes first
  return traits.sort((a, b) => (a.source === b.source ? 0 : a.source === "measured" ? -1 : 1));
}

function buildLearnings(waveNumber: number, traits: WinnerTrait[]): string {
  if (traits.length === 0) {
    return `Wave ${waveNumber} produced no SCALE verdicts. The next wave should try assets closer to audience-known context and avoid repeating the failed angle.`;
  }
  const measuredCount = traits.filter((t) => t.source === "measured").length;
  const traitList = traits.map((t) => (t.source === "measured" ? `${t.trait} [measured]` : t.trait)).join("; ");
  const priorityNote =
    measuredCount > 0
      ? ` ${measuredCount} of these winner(s) are backed by real measured data: prioritize those traits first.`
      : "";
  return `Winning traits from wave ${waveNumber}: ${traitList}. Prioritize reusing these asset shapes and angleType combinations in new variants.${priorityNote}`;
}

export async function runLearn(
  waveNumber: number,
  moment: string,
  variants: Variant[],
  namedAssets: NamedAsset[],
  decisions: Decision[]
): Promise<LearningEntry> {
  const winnerDecisions = decisions.filter((d) => d.verdict === "SCALE");
  const traits = extractTraits(winnerDecisions, variants, namedAssets);

  const entry: LearningEntry = {
    wave: waveNumber,
    moment,
    timestamp: new Date().toISOString(),
    winners: traits.map((t) => t.assetName),
    traits: traits.map((t) => t.trait),
    learnings: buildLearnings(waveNumber, traits),
    sources: Object.fromEntries(traits.map((t) => [t.assetName, t.source])),
  };

  await appendJSONL(LIBRARY_PATH, entry);
  return entry;
}

// Used by the measure stage: a measured decide pass can change a wave's
// winners after the fact, so its library.jsonl entry needs to be rewritten
// in place rather than appended as a duplicate.
export async function updateLibraryEntry(
  waveNumber: number,
  moment: string,
  variants: Variant[],
  namedAssets: NamedAsset[],
  decisions: Decision[]
): Promise<LearningEntry> {
  const winnerDecisions = decisions.filter((d) => d.verdict === "SCALE");
  const traits = extractTraits(winnerDecisions, variants, namedAssets);

  const entries = await readJSONL<LearningEntry>(LIBRARY_PATH);
  const existing = entries.find((e) => e.wave === waveNumber);

  const entry: LearningEntry = {
    wave: waveNumber,
    moment,
    timestamp: existing?.timestamp ?? new Date().toISOString(),
    winners: traits.map((t) => t.assetName),
    traits: traits.map((t) => t.trait),
    learnings: buildLearnings(waveNumber, traits),
    sources: Object.fromEntries(traits.map((t) => [t.assetName, t.source])),
  };

  const updated = existing
    ? entries.map((e) => (e.wave === waveNumber ? entry : e))
    : [...entries, entry];
  await writeJSONL(LIBRARY_PATH, updated);
  return entry;
}

// used by insight/brief for the next wave, before it starts: reads the
// learnings text off the last entry in library.jsonl
export async function getInjectedLearnings(): Promise<string | null> {
  const entries = await readJSONL<LearningEntry>(LIBRARY_PATH);
  if (entries.length === 0) return null;
  return entries[entries.length - 1].learnings;
}

// used by the `next` command: reconstructs the last run's moment and latest wave number from library.jsonl
export async function getLastRunState(): Promise<{ moment: string; lastWave: number } | null> {
  const entries = await readJSONL<LearningEntry>(LIBRARY_PATH);
  if (entries.length === 0) return null;
  const last = entries[entries.length - 1];
  return { moment: last.moment, lastWave: last.wave };
}
