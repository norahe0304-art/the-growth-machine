# The Growth Machine

The machine runs on the agent you already pay for.

The Growth Book explains the formula. This runs it. It does not run as a standalone
application. It installs as a routine into an agent you already have a subscription for
(Claude Code or Codex CLI). The agent itself carries the LLM stations. This repo's scripts
carry the deterministic stations. That split means the skill mode below needs zero API key
and zero infrastructure of its own. This project is itself an instance of The Growth Book's
Pitch 05, the routine exchange. It is a routine that installs into an agent someone already
pays for, it runs for free inside that subscription, and it is easy enough to hand to the
next person that it recruits its own next user.

The book's formula is: existing asset x one new element. Asset means one of two things. It
is a thing people already own, or an interaction people already know how to do. You feed
this machine any moment. It runs that moment through six stations. It comes out the other
end with named assets, generated creative, a test plan, a market response simulation, and a
machine made scale/kill/iterate call. Then it does it again, and the next wave knows what
won last time.

## Honest boundary

Generation is real when it runs. Copy and images go through a real model call. In skill
mode the model is the agent itself for copy, and `codex exec` for the actual image pixels.
In CLI mode both go through the OpenAI API. Either way the call is real. Real tokens get
spent. Real pixels get written to disk.

Market response is simulated. There is no ad account behind this. CTR curves, share rates,
and fatigue slopes all come from three deterministic response models seeded off the asset
name. None of it comes from a live campaign. The machine's job is to prove out decision
logic. It does not buy media. Do not read the CTR numbers as real performance data. Read the
SCALE/KILL/ITERATE calls as a demonstration of how a machine would decide, given real
thresholds and a plausible curve shape.

## Every step leaves a record

Nine segment names encode the full provenance of every asset. Judge scores and notes
persist per asset, including retry counts. Thresholds are preregistered before any data
exists, and every verdict cites them. Every number carries a simulated or measured source
flag. `library.jsonl` records what each wave taught the machine. Humans stay in the loop:
real data enters by hand and nothing publishes itself. This is autonomy with an audit
trail.

## Quickstart

Two ways to run this. Skill mode is the main track. CLI headless mode is the fallback for
running the pipeline without an agent in the loop.

### Skill mode (primary)

Requires Claude Code or Codex CLI. Requires no API key and no `npm install` beyond the dev
dependencies already checked into this repo (`tsx` drives the scripted stations).

```bash
./install.sh
```

This symlinks `skill/` into `~/.claude/skills/growth-machine`. Restart Claude Code, then
open this repo and say something like "run the growth machine on the world cup final." The
agent reads `skill/SKILL.md`, reasons through insight, brief, and judge itself, and calls
`scripts/machine.mjs` for naming, plan, simulate, decide, report, and learn. See
`skill/SKILL.md` for the full six station contract, and `skill/CODEX.md` for the Codex CLI
equivalent, driven through `codex exec` instead of a single reasoning session.

### CLI headless mode (optional, needs OPENAI_API_KEY)

For running a wave without an agent in the loop, or for CI.

```bash
npm install
npx tsc --noEmit          # typecheck, should be clean
npm test                  # naming / simulate / decide / measure / machine unit tests

# no OPENAI_API_KEY needed for this, mock mode kicks in automatically
./bin/growth-machine run "the world cup final" --waves 2 --mock

# with a real key, real generation:
export OPENAI_API_KEY=sk-...
./bin/growth-machine run "your moment here" --waves 1

# continue the same moment from where library.jsonl left off
./bin/growth-machine next

# record real channel numbers against a wave that's already run, and get a
# real-vs-predicted overlay back
./bin/growth-machine measure --wave 1 --file metrics.json
```

Each wave writes to `waves/wave-NN/`, in either mode:

```
waves/wave-01/
  brief-v1.json          brief-v2.json          brief-v3.json
  plan.json
  readout.json           full machine-readable dump of the wave
  report.html            single-file, open it in a browser
  assets/
    WEB_CONV_TOF_HOT_STIL_..._V01.png (or .svg in --mock)
```

`library.jsonl` at the repo root accumulates one line per wave. It records which assets got
SCALE'd, what traits they shared, and a learnings string that gets injected into the next
wave's insight/brief prompts. That is the evolution loop. It is not a metaphor. It is an
actual string concatenated into the next LLM call, whichever mode produced it.

## Six stations, ten files

The book names six stations. The code splits two of them into helper stages (naming and
learn call no LLM, plan is a hybrid), and adds one conditional station of its own, rollout,
that only fires on a SCALE verdict. That gives ten files for six conceptual stops.

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
[5] produce.ts   real image call (still) + real copy call, motion stays a prompt
  |
  v
[6] judge.ts     LLM self-check, 3-point scale, one fail -> one retry, then move on
  |
  v
[7] simulate.ts  21-day curve, response model picked by angleType, seeded noise
  |
  v
[8] decide.ts    predicted curve vs preRegisteredThresholds -> SCALE / KILL / ITERATE
  |
  v
[8b] rollout.ts  SCALE verdict -> a channel by channel playbook, skipped for KILL / ITERATE
  |
  v
[9] learn.ts     append library.jsonl, extract winner traits, inject into next wave
  |
  +-- loops back into [1] insight.ts for wave N+1
```

Stations 1, 2, and 6 (insight, brief, judge) are LLM stations. In skill mode the agent
running `skill/SKILL.md` or `skill/CODEX.md` performs them directly. In CLI mode
`src/lib/openai-client.ts` calls the OpenAI API for them. Station 8b (rollout) is a hybrid,
same shape as plan: rules pick the channel and role pool, one LLM call writes the sentences,
a schema gate checks them before they reach `readout.json`. Stations 3, 4, 7, 8, and 9
(naming, plan, simulate, decide, learn) are deterministic. Both modes run the exact same
code for them, `src/stages/*.ts`, either through `bin/growth-machine` or through
`scripts/machine.mjs`.

There is an eleventh file, `measure.ts`. It is not part of the six station loop above. It runs
after the fact, against a wave that has already shipped a report. See "Measure: simulator to
instrument" below.

## Measure: simulator to instrument

Everything above this line predicts. `growth-machine measure` is where the prediction meets
a real channel number. This station is unchanged between skill mode and CLI mode. Always
call the standalone CLI for it:

```bash
# interactive: prompts once per still asset in the wave
./bin/growth-machine measure --wave 1

# or feed it a file
./bin/growth-machine measure --wave 1 --file metrics.json
```

`metrics.json` is a flat list of channel readings, one per asset per check-in:

```json
{
  "wave": 1,
  "entries": [
    {
      "assetName": "WEB_ENGT_MOF_EVG_STIL_THEW_THEWOR_THEW_V01",
      "channel": "xiaohongshu",
      "day": 3,
      "impressions": 15000,
      "likes": 620,
      "comments": 48,
      "shares": 133,
      "saves": 210
    }
  ]
}
```

Each reading normalizes to `engagementRate = (likes + comments + shares + saves) /
impressions`. Run `measure` again later in the same wave's window with a new `day` and the
reading gets appended. It never gets overwritten. Call it three times across three weeks and
you get an actual three point measured curve instead of a single snapshot dressed up as one.

Any asset that has at least one measured reading gets re-decided. SCALE/KILL/ITERATE is
recomputed from real `engagementRate` against the `engagementThresholds` table (see below),
never from the simulated CTR curve. Everything else in the wave stays exactly as the
simulated pass left it. `readout.json`, `report.html`, and that wave's line in
`library.jsonl` all get rewritten in place. The report's predicted curve renders dashed. The
measured points render as a solid line connecting the actual check-ins. Every winner in the
library summary carries a `measured` or `simulated` badge so you can tell which verdicts are
real. The next wave's `learn` injection prioritizes measured winners over simulated ones when
it writes the carry-forward traits.

The operator's version of this: a simulator that never gets checked against reality is just
a very confident guess generator. The moment real numbers get backfilled through `measure`,
every prediction this machine made for that wave gets graded. The dashed line either tracks
the solid one or it does not, and either way you now know something you did not know before.
An instrument's predictions are falsifiable on a schedule, wave after wave. This one's
schedule is whenever you paste in the numbers.

`metrics.demo.json` at the repo root is illustrative. The numbers are hand built rather than
pulled from a real campaign. It is checked in so `./bin/growth-machine measure --wave 1 --file
metrics.demo.json` reproduces the predicted-vs-measured overlay in `waves/wave-01/report.html`
without needing a live channel to pull from.

## Taxonomy: the nine-segment name

`CHANNEL_OBJ_FUNNEL_TEMP_FORMAT_HOOK_MOMENT_PERSONA_VER`

No LLM touches this. The first five segments come from a fixed dictionary. The last four are
deterministic slugs of the input text. Same variant, same format, same moment, same version
produces the same name, every time.

| segment | source | example values |
|---|---|---|
| CHANNEL | fixed | `WEB` (cross-channel; a platform has not been assigned yet) |
| OBJ | assetKind | `CONV` (thing) / `ENGT` (interaction) |
| FUNNEL | angleType | `TOF` (moment) / `MOF` (evergreen) / `BOF` (ugc-loop) |
| TEMP | angleType | `HOT` (moment) / `EVG` (evergreen) / `LOOP` (ugc-loop) |
| FORMAT | format | `STIL` / `MOTN` |
| HOOK | slug of `angle`, 4 chars | `THEW`, `KICK` |
| MOMENT | slug of moment text, 6 chars | `THEWOR` |
| PERSONA | slug of audience, 4 chars | `FANS` |
| VER | wave number, zero-padded | `V01`, `V12` |

Dictionaries live in `src/taxonomy.ts`. Slugging strips non-alphanumerics, uppercases,
truncates, or pads with `X`.

## Preregistered thresholds

Written into `src/stages/plan.ts` as a constant. It is never computed at decision time. That
immutability is the point of preregistration. You cannot move the goalposts after you see
the curve.

| angleType | scaleAt | killAt | fatigueSlope |
|---|---|---|---|
| moment | 0.045 | 0.015 | -0.004 |
| evergreen | 0.035 | 0.012 | -0.0015 |
| ugc-loop | 0.050 | 0.018 | -0.002 |

`measure`'s decide path uses a parallel table, `ENGAGEMENT_THRESHOLDS` in the same file,
scaled for `engagementRate` instead of CTR:

| angleType | scaleAt | killAt | fatigueSlope |
|---|---|---|---|
| moment | 0.08 | 0.02 | -0.01 |
| evergreen | 0.06 | 0.015 | -0.004 |
| ugc-loop | 0.10 | 0.025 | -0.006 |

## Config

Config below applies to CLI headless mode. Skill mode needs none of it (leave
`OPENAI_API_KEY` unset so `plan`'s one rationale sentence stays on its deterministic mock
path, which is correct in skill mode).

| env var | default | notes |
|---|---|---|
| `OPENAI_API_KEY` | none | missing key forces mock mode regardless of `--mock` |
| `MODEL` | `gpt-5.4` | used for insight/brief/plan-rationale/copy/judge |
| `IMAGE_MODEL` | `gpt-image-2` | 404 or unknown-model error auto-falls back to `gpt-image-1`, logs the fallback |

## What's not built

No third-party frameworks besides `openai`, `tsx`, and type packages. CLI parsing is
`node:util.parseArgs`. Nothing else. Motion assets are never rendered. The machine hands you
a `[for ChatCut]` script and a three-line storyboard. ChatCut does the rest. The real-key API
path is written and typechecked but has not been run against a live OpenAI account in this
environment. Skill mode's `codex exec` image call depends on `codex` being installed and
authenticated on the machine running the agent. When it is not, the machine hands the image
prompt to the user instead of failing the wave.
