---
name: growth-machine
description: >
  Runs any moment (a news event, a topic, a cultural beat) through The Growth Machine's
  six-station pipeline, with the agent itself acting as the insight/brief/judge model, no
  API key, no per-token bill beyond the subscription already running this conversation.
  Naming, plan, simulate, decide, and learn run as deterministic scripts. Produce's real
  image call goes through codex exec when available, or hands the image prompt to the user
  when it isn't. Produces named assets, generated creative, a test plan, a market-response
  simulation, and a machine-made SCALE/KILL/ITERATE call, wave after wave, each one
  carrying forward what the last one won. Use when the user says "run the growth machine",
  "growth machine wave", pastes a moment and asks for creative variants plus a test plan, or
  invokes the asset x new element formula from The Growth Book. Triggers: "growth machine",
  "run a wave", "the growth machine skill", "asset x new element", "insight brief naming
  plan produce judge simulate decide learn", "/growth-machine".
---

<!--
[INPUT]: the agent's own reasoning (insight/brief/judge stations, stdin-free, the agent
  writes the JSON itself) + scripts/machine.mjs (naming/plan/simulate/decide/report/learn,
  stdin-JSON-in/stdout-JSON-out) + codex exec GPT-Image (produce's image call, optional) +
  bin/growth-machine measure (measure station, unchanged, post-hoc)
[OUTPUT]: waves/wave-NN/{brief-v1.json, brief-v2.json, brief-v3.json, plan.json,
  assets/*.png, readout.json, report.html} + one appended library.jsonl line per wave
[POS]: the skill-layer twin of bin/growth-machine, same nine files in src/, same six
  conceptual stations, same taxonomy, same thresholds. The only thing that changes between
  CLI mode and skill mode is who calls the LLM stations: a paid OpenAI API key in CLI mode,
  the agent's own weights in skill mode. See CODEX.md for the Codex CLI equivalent of this
  file, same stations, same contracts, `codex exec` idiom instead of native reasoning.
[PROTOCOL]: update this header on change, then check CLAUDE.md
-->

# The Growth Machine, skill mode

The machine runs on the agent you already pay for. `insight`, `brief`, and `judge` are LLM
stations. In CLI mode `src/lib/openai-client.ts` calls OpenAI to run them. In skill mode you
,  the agent reading this file, are the model. You write the JSON those stations would have
returned, directly, by following the prompt contracts below. No API key, no HTTP call, no
per-token bill beyond the subscription already running this conversation.

`naming`, `plan`, `simulate`, `decide`, `report`, and `learn` are deterministic. Call
`scripts/machine.mjs` for these, it is the exact same code as the standalone CLI
(`src/stages/*.ts`), just exposed as stdin-JSON-in / stdout-JSON-out subcommands so you can
drive it directly. Do not reimplement their logic yourself; call the script.

`produce`'s copy and motion-script deliverables are also yours to write directly (they are
plain text against a prompt, exactly the shape `brief.generationPrompts.copy` and `.motion`
already specify). Its real image call is the one station that still wants a model with
image-generation capability, use `codex exec` if it is installed and authenticated; if it
is not, hand the image prompt to the user instead of failing the wave.

`measure` is untouched, it was never part of the six-station loop (it runs after the fact,
against a wave that already shipped). Use the existing CLI for it: see "Measure" below.

This skill is itself an instance of The Growth Book's Pitch 05, the routine exchange: a
routine that installs into an agent someone already pays for, runs for free inside that
subscription, and is easy enough to hand to the next person that it recruits its own next
user.

## Before you start

Set cwd to the repo root (`the-growth-machine/`) before calling anything, every scripted
stage resolves `waves/` and `library.jsonl` off `process.cwd()`, the same way the standalone
CLI does. Confirm with `ls scripts/machine.mjs` first. Do not set `OPENAI_API_KEY`, leaving
it unset keeps `plan`'s one rationale sentence on its deterministic mock path, which is the
correct behavior in skill mode (rules decide the plan, not a model call).

Ask the user for **the moment** (a news event, topic, or cultural beat) and **the wave
number** (1 for a fresh moment, or call `learn last`, see below, to continue one already
in progress) before starting station 1.

## The formula, fixed

Every variant this machine produces must satisfy: **existing asset x one new element**.

- `asset` is something the audience already owns or already recognizes. Exactly two shapes:
  `"thing"` (a concrete object they own) or `"interaction"` (a concrete interaction they
  already know how to do).
- `newElement` is the single new variable, the one thing that grafts the moment's core
  tension onto the asset.
- Nothing about the asset itself gets redesigned except the `newElement` graft, it must
  stay fully recognizable.
- `angleType` is one of `"moment"` (trend-riding, decays fast), `"evergreen"` (steady,
  durable reach), or `"ugc-loop"` (reused/remixed wave after wave, compounding). It decides
  which response-curve family `simulate` picks and which preregistered thresholds `decide`
  checks against.

## Station 1, insight (you are the model)

Before generating, call `node scripts/machine.mjs learn get` (no stdin) to fetch
`injectedLearnings`, the previous wave's winning traits, if any. If it is non-null, extend
those traits while keeping the formula rules intact; that is where real evolution happens.

Follow this instruction, in full, to produce exactly 3 variants:

> You crack a moment into 3 creative variants that fit the "existing asset x one new
> element" formula.
>
> Formula rules:
> 1. `asset` must be something the audience already owns or already recognizes. It can only
>    be one of two shapes: `"thing"`, things people own, a concrete object the audience
>    already owns; or `"interaction"`, interactions people know, a concrete interaction
>    the audience already knows how to do.
> 2. `newElement` is the single new variable, the one thing that grafts the moment's core
>    tension onto the asset.
> 3. Nothing about the asset itself may be redesigned except the `newElement` graft, it
>    must stay fully recognizable.
> 4. `angle` is a one-sentence description of this variant's hook logic.
> 5. `angleType` must be exactly one of three values, and it decides which distribution-curve
>    family this variant gets: `"moment"` (trend-riding, attention decays fast), `"evergreen"`
>    (doesn't depend on topical heat, settles into steady durable reach), `"ugc-loop"` (a UGC
>    loop, gets reused/remixed wave after wave, compounding).
> 6. `workingTitle` is a working codename of 5 words or fewer.
>
> If winning traits from a previous wave were injected, extend them while keeping the
> formula rules intact.
>
> Produce exactly 3 variants, one of each `angleType`, in this shape:
> `{"variants":[{"id":"v1","asset":"...","assetKind":"thing|interaction","newElement":"...","angle":"...","angleType":"moment|evergreen|ugc-loop","workingTitle":"..."}, ...3 total]}`

Hold the 3 `Variant` objects in memory (`id` = `v1`/`v2`/`v3`), every later station consumes
them.

## Station 2, brief (you are the model)

For each of the 3 variants, compress it into a one-page brief. `generationPrompts` is the
most important deliverable, it must be ready to run as-is, not a summary:

> Input is a creative variant that already satisfies the "existing asset x one new element"
> formula; compress it into a one-page executable brief.
>
> `generationPrompts` is the most important deliverable of this station, it must be a
> "ready to run as-is" complete prompt, not a summary, not an outline:
> - `image`: a complete image-generation prompt, including composition/lighting/style/
>   subject detail.
> - `motion`: a complete motion-script prompt, explicitly tagged "for ChatCut", explaining
>   the shot logic.
> - `copy`: a complete copy-generation prompt, specifying tone/length/key points.
>
> Output shape: `{"audience":"...","insight":"...","assetXElement":"...","formats":["still","motion"],"successMetric":"...","generationPrompts":{"image":"...","motion":"...","copy":"..."}}`

Write one `brief-v{N}.json` per variant to `waves/wave-{NN}/brief-v{N}.json` (zero-padded
wave number, matching `waveDirName`, e.g. `waves/wave-01/brief-v1.json`). Use the `Brief`
shape: `{variantId, workingTitle, audience, insight, assetXElement, formats, successMetric,
generationPrompts}`.

## Station 3, naming (scripted, deterministic, no LLM)

```bash
node scripts/machine.mjs name <<'EOF'
{"moment":"<moment>","waveNumber":<N>,"variants":[<the 3 Variant objects>],"audienceByVariant":{"v1":"<brief-v1.audience>","v2":"<brief-v2.audience>","v3":"<brief-v3.audience>"}}
EOF
```

Returns a `NamedAsset[]`, 6 entries, one still and one motion per variant, each named
`CHANNEL_OBJ_FUNNEL_TEMP_FORMAT_HOOK_MOMENT_PERSONA_VER`. Same input always produces the
same name; this station never calls a model. Hold the array, every later station indexes
into it by `variantId` + `format`.

## Station 4, plan (scripted rules + one mocked rationale sentence)

```bash
node scripts/machine.mjs plan <<'EOF'
{"moment":"<moment>","waveNumber":<N>,"variants":[<3 Variant objects>],"namedAssets":[<6 NamedAsset objects from station 3>]}
EOF
```

Writes `waves/wave-{NN}/plan.json` and returns the `Plan` object (arms, traffic split,
21-day observation window, preregistered thresholds, one rationale sentence). Thresholds are
hardcoded in `src/stages/plan.ts`, never recomputed at decide time. Hold the returned
`Plan`, `simulate`, `decide`, and `report` all need it.

## Station 5, produce (mixed: you write copy/motion, codex exec makes the image)

For each of the 6 named assets:

**Copy** (every asset, still and motion): write exactly one line of copy per
`brief.generationPrompts.copy`, in English, no explanation, no surrounding quotes.

**Motion assets**: never get rendered. Write a three-shot storyboard array following
`brief.generationPrompts.motion`, shot 1 establishes the asset in its everyday context,
shot 2 introduces the new element as contrast, shot 3 lands the hook copy. `assetPath` stays
`null` for motion; `motionScript` holds the 3-line array.

**Still assets**: this is the one real generation call in the whole pipeline. If `codex` is
installed and authenticated, run it against `brief.generationPrompts.image`:

```bash
codex exec --skip-git-repo-check - <<PROMPT
Generate an image with your image generation tool and save it to waves/wave-{NN}/assets/{NamedAsset.name}.png :
{brief.generationPrompts.image}
PROMPT
```

Then `Read` the resulting PNG and self-check: does the subject match the brief, is the
composition coherent, no garbled text, no watermark. If it fails, retry the prompt once; if
it still fails, ship it anyway and note the defect in the judge station's notes, one retry
is the same ceiling `runJudge` enforces in CLI mode. If `codex` is not installed or not
authenticated, do not fail the wave: write `brief.generationPrompts.image` into the asset's
`copy` field's neighbor (a short note in `readout.json`, or directly to the user) and set
`assetPath` to `null`, so the user can run the prompt through whatever image tool they have.

Build a `ProducedAsset` per named asset: `{variantId, format, name, assetPath, copy,
motionScript, imageModelUsed, regeneratedCount}` (`imageModelUsed` is a free-text label like
`"codex-exec"` or `null` if generation was handed off).

## Station 6, judge (you are the model)

For each produced asset, score it yourself against this instruction:

> You are a strict asset referee. Given the brief and the actual produced copy / image
> prompt / storyboard, score the asset on a 3-point scale: 1 = fail, 2 = pass, 3 =
> excellent. Three dimensions:
> - `onBrief`: did it faithfully execute the brief's `assetXElement` and `insight`.
> - `legible`: can the audience understand what's happening within one second.
> - `shareable`: does the audience feel an urge to share/remix it.
>
> Output shape: `{"onBrief":1|2|3,"legible":1|2|3,"shareable":1|2|3,"notes":"..."}`

Any dimension scoring `1` counts as a fail. On a fail, regenerate that one asset once
(rerun the produce step for it, new copy, or a retried `codex exec` for stills), then score
the regenerated version and stop regardless of the second result, at most one retry, same
rule `runJudge` enforces. Build a `JudgeResult` per asset: `{variantId, format, score,
passed, regenerated, notes}`.

## Station 7, simulate (scripted, seeded, deterministic)

```bash
node scripts/machine.mjs simulate <<'EOF'
{"namedAssets":[<6 NamedAsset objects>],"variants":[<3 Variant objects>],"days":<plan.dates.days>,"waveNumber":<N>}
EOF
```

Returns a `SimulatedCurve[]`, 3 entries, still assets only (motion never enters the media
curve). Curve family is picked by `angleType`; the seed is a hash of the asset name, so
reruns with the same name are always identical. This is where the honest boundary lives: no
ad account, no real impressions, three deterministic response models standing in for one.

## Station 8, decide (scripted, pure rules)

```bash
node scripts/machine.mjs decide <<'EOF'
{"simulated":[<3 SimulatedCurve objects from station 7>],"plan":<the Plan object from station 4>}
EOF
```

Returns a `Decision[]`, SCALE / KILL / ITERATE per still asset, checked against the plan's
preregistered thresholds. Motion assets never get decided (no curve to decide against).

## Report, assemble and render

Assemble the full `WaveReadout`:

```json
{
  "moment": "<moment>", "waveNumber": <N>,
  "variants": [<3>], "briefs": [<3>], "namedAssets": [<6>], "plan": <Plan>,
  "produced": [<6 ProducedAsset>], "judged": [<6 JudgeResult>],
  "simulated": [<3 SimulatedCurve>], "decided": [<3 Decision>],
  "measured": [], "injectedLearnings": "<from learn get, or null>"
}
```

```bash
node scripts/machine.mjs report <<'EOF'
{"readout": <the WaveReadout object above>}
EOF
```

Writes `waves/wave-{NN}/readout.json` and `waves/wave-{NN}/report.html`, and returns both
paths. `report.html` is self-contained, open it directly in a browser.

## Station 9, learn (scripted, commits the evolution loop)

```bash
node scripts/machine.mjs learn commit <<'EOF'
{"waveNumber":<N>,"moment":"<moment>","variants":[<3>],"namedAssets":[<6>],"decisions":[<3 Decision objects>]}
EOF
```

Appends one line to `library.jsonl`: which assets got a SCALE verdict, what traits they
shared, and a learnings string. That string is what station 1's `learn get` will inject into
wave N+1's insight prompt, not a metaphor, an actual string carried forward.

Report to the user: variant count, assets produced, SCALE/KILL/ITERATE counts, and the path
to `report.html`.

## Continuing a moment (`learn last`)

To run the next wave of a moment already in progress:

```bash
node scripts/machine.mjs learn last
```

Returns `{"moment": "...", "lastWave": N}` (or `null` if `library.jsonl` is empty). Use
`lastWave + 1` as the new wave number and the same `moment` string, then run stations 1
through 9 again.

## Measure (unchanged, post-hoc, not part of the six-station loop)

`measure` runs after a wave has already shipped a report, against real channel numbers. It
was never part of the loop above and stays exactly as the standalone CLI already built it , 
call it directly, no skill-layer wrapper needed:

```bash
./bin/growth-machine measure --wave <N> --file metrics.json
```

Or interactively (prompts once per still asset) with `--wave <N>` and no `--file`. This
re-decides every measured asset against `ENGAGEMENT_THRESHOLDS` and rewrites that wave's
`readout.json`, `report.html`, and `library.jsonl` line in place, everything else in the
wave stays exactly as the simulated pass left it.

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
