# The Growth Machine

The Growth Book explains the formula. This runs it.

The book's formula is: existing asset x one new element. Asset means one of two things — a thing people already own, or an interaction people already know how to do. You feed this machine any moment, it runs that moment through six stations, and it comes out the other end with named assets, generated creative, a test plan, a market-response simulation, and a machine-made scale/kill/iterate call. Then it does it again, and the next wave knows what won last time.

## Honest boundary

Generation is real. Copy and images go through the OpenAI API — actual API calls, actual tokens spent, actual pixels written to disk.

Market response is simulated. There is no ad account behind this. CTR curves, share rates, fatigue slopes — all of it comes from three deterministic response models seeded off the asset name, not from a live campaign. The machine's job is to prove out decision logic, not to buy media. Don't read the CTR numbers as real performance data. Read the SCALE/KILL/ITERATE calls as a demonstration of how a machine would decide, given real thresholds and a plausible curve shape.

## Quickstart

```bash
npm install
npx tsc --noEmit          # typecheck, should be clean
npm test                  # naming / simulate / decide unit tests

# no OPENAI_API_KEY needed for this, mock mode kicks in automatically
./bin/growth-machine run "the world cup final" --waves 2 --mock

# with a real key, real generation:
export OPENAI_API_KEY=sk-...
./bin/growth-machine run "your moment here" --waves 1

# continue the same moment from where library.jsonl left off
./bin/growth-machine next
```

Each wave writes to `waves/wave-NN/`:

```
waves/wave-01/
  brief-v1.json          brief-v2.json          brief-v3.json
  plan.json
  readout.json           full machine-readable dump of the wave
  report.html            single-file, open it in a browser
  assets/
    WEB_CONV_TOF_HOT_STIL_..._V01.png (or .svg in --mock)
```

`library.jsonl` at the repo root accumulates one line per wave: which assets got SCALE'd, what traits they shared, and a learnings string that gets injected into the next wave's insight/brief prompts. That's the evolution loop — not a metaphor, an actual string concatenated into the next LLM call.

## Six stations, nine files

The book names six stations. The code splits two of them into helper stages (naming and learn don't call an LLM, plan is a hybrid) — nine files, six conceptual stops.

```
moment
  |
  v
[1] insight.ts   moment -> 3 variants (asset x newElement, angleType)
  |
  v
[2] brief.ts     variant -> one-page brief, generationPrompts is the product
  |
  v
[3] naming.ts    deterministic nine-segment name, no LLM, same input same output
  |
  v
[4] plan.ts      rules + LLM -> arms, traffic split, dates, preRegisteredThresholds
  |
  v
[5] produce.ts   real Images API call (still) + real copy call, motion stays a prompt
  |
  v
[6] judge.ts     LLM self-check, 3-point scale, one fail -> one retry, then move on
  |
  v
[7] simulate.ts  21-day curve, response model picked by angleType, seeded noise
  |
  v
[8] decide.ts    predicted curve vs preRegistered thresholds -> SCALE / KILL / ITERATE
  |
  v
[9] learn.ts     append library.jsonl, extract winner traits, inject into next wave
  |
  +-- loops back into [1] insight.ts for wave N+1
```

## Taxonomy: the nine-segment name

`CHANNEL_OBJ_FUNNEL_TEMP_FORMAT_HOOK_MOMENT_PERSONA_VER`

No LLM touches this. First five segments come from a fixed dictionary, last four are deterministic slugs of the input text. Same variant, same format, same moment, same version — same name, every time.

| segment | source | example values |
|---|---|---|
| CHANNEL | fixed | `WEB` (cross-channel, not yet assigned to a platform) |
| OBJ | assetKind | `CONV` (thing) / `ENGT` (interaction) |
| FUNNEL | angleType | `TOF` (moment) / `MOF` (evergreen) / `BOF` (ugc-loop) |
| TEMP | angleType | `HOT` (moment) / `EVG` (evergreen) / `LOOP` (ugc-loop) |
| FORMAT | format | `STIL` / `MOTN` |
| HOOK | slug of `angle`, 4 chars | `THEW`, `KICK` |
| MOMENT | slug of moment text, 6 chars | `THEWOR` |
| PERSONA | slug of audience, 4 chars | `FANS` |
| VER | wave number, zero-padded | `V01`, `V12` |

Dictionaries live in `src/taxonomy.ts`. Slugging strips non-alphanumerics, uppercases, truncates or pads with `X`.

## Preregistered thresholds

Written into `src/stages/plan.ts` as a constant, not computed at decision time — that's the point of preregistration, you can't move the goalposts after you see the curve.

| angleType | scaleAt | killAt | fatigueSlope |
|---|---|---|---|
| moment | 0.045 | 0.015 | -0.004 |
| evergreen | 0.035 | 0.012 | -0.0015 |
| ugc-loop | 0.050 | 0.018 | -0.002 |

## Config

| env var | default | notes |
|---|---|---|
| `OPENAI_API_KEY` | none | missing key forces mock mode regardless of `--mock` |
| `MODEL` | `gpt-5.4` | used for insight/brief/plan-rationale/copy/judge |
| `IMAGE_MODEL` | `gpt-image-2` | 404 or unknown-model error auto-falls back to `gpt-image-1`, logs the fallback |

## What's not built

No third-party frameworks besides `openai`, `tsx`, and type packages. CLI parsing is `node:util.parseArgs`, nothing else. Motion assets are never rendered — the machine hands you a `[for ChatCut]` script and a three-line storyboard, ChatCut does the rest. The real-key API path is written and typechecked but has not been run against a live OpenAI account in this environment.
