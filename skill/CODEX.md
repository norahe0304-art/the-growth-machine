# The Growth Machine, Codex CLI mode

<!--
[INPUT]: codex exec (insight/brief/judge/produce/rollout-authoring stations) +
  scripts/machine.mjs (naming/plan/simulate/decide/rollout-validate/report/learn,
  stdin-JSON-in/stdout-JSON-out) + bin/growth-machine measure (measure station, unchanged,
  post-hoc)
[OUTPUT]: waves/wave-NN/{brief-v1.json, brief-v2.json, brief-v3.json, plan.json,
  assets/*.png, readout.json, report.html} + one appended library.jsonl line per wave
[POS]: the Codex-CLI twin of skill/SKILL.md, same ten-station pipeline (insight, brief,
  naming, plan, produce, judge, simulate, decide, rollout as station 8b conditional on a
  SCALE verdict, learn), same JSON contracts, same scripted stages. Where SKILL.md has
  Claude Code reason directly inside one conversation, this file drives every LLM station
  through a separate `codex exec` call, because Codex CLI's exec mode is one-shot and
  headless rather than a persistent reasoning loop. Whoever runs this (a shell, a script, a
  human, another agent) is the orchestrator; codex exec is the LLM engine for
  insight/brief/judge/produce/rollout.
[PROTOCOL]: update this header on change, then check CLAUDE.md
-->

**Station index** — jump straight to a station without reading top to bottom:
1. [Station 1, insight](#station-1-insight)
2. [Station 2, brief](#station-2-brief)
3. [Station 3, naming](#station-3-naming-scripted)
4. [Station 4, plan](#station-4-plan-scripted)
5. [Station 5, produce](#station-5-produce-codex-exec-for-image-copymotion-are-also-codex-exec-calls-here)
6. [Station 6, judge](#station-6-judge)
7. [Station 7, simulate](#station-7-simulate-scripted)
8. [Station 8, decide](#station-8-decide-scripted)
8b. [Station 8b, rollout](#station-8b-rollout-codex-exec-only-for-scale-verdicts) (SCALE-only; real video steps live in `skill/references/rollout-video.md`)
9. [Station 9, learn](#station-9-learn-scripted)

Same machine, same ten-station pipeline (insight, brief, naming, plan, produce, judge,
simulate, decide, rollout as station 8b conditional on a SCALE verdict, learn), same ten
files in `src/`. The only thing that changes from `SKILL.md` is how the LLM stations get called:
instead of one agent reasoning through the whole wave in a single conversation, each LLM
station is its own `codex exec` call, prompt in via stdin heredoc, JSON out via stdout,
captured to a file, fed into the next station. Deterministic stations
(`naming`/`plan`/`simulate`/`decide`/`rollout-validate`/`report`/`learn`) are
identical to `SKILL.md`, call `scripts/machine.mjs`, do not reimplement.

## Before you start

cwd must be the repo root. Confirm with `ls scripts/machine.mjs`. Do not set
`OPENAI_API_KEY`, `plan`'s one rationale sentence should stay on its deterministic mock
path in skill mode.

Check `brand/<pack>/` for a brand pack, default pack is `openai`. When the directory
exists, Read all four files, `brand.md`, `design.md`, `channels.md`, `history.md`, and
hold them for the whole wave, several stations below fold their content into a `codex exec`
prompt. Check `references/` for the channel winners libraries too, and pull the file that
matches the target channel, or `cross-channel.md` when no channel is set yet, at whichever
station below calls for it.

Prompts always go through stdin, never through a shell argument, a detached/background
`codex exec` reads an empty stdin if the prompt is passed as an argument instead
(the same judgment call `30x-covers`' command skeleton already made).

## Gotchas

- Never set `OPENAI_API_KEY`, keep `plan`'s rationale sentence on its mock path.
- One retry ceiling pipeline-wide: a failed still, judge dimension, or rollout image gets
  exactly one retry, then ship (or null out) and move on.
- Never fake motion with `zoompan`. A video channel is real image-to-video generation;
  ffmpeg only assembles.
- A `ugc-loop` concept gets a real `ParticipationKit`, never a faked UGC image; an
  AI-generated `ugc-still` still needs `illustrativeLabel: "template preview, illustrative"`.
- Rollout output bans the em dash and en dash anywhere.
- `assetName`'s `CHANNEL` segment is a deterministic swap, not a model decision.
- Thresholds are preregistered in `src/stages/plan.ts`, never recomputed at decide time.
- Motion assets never render and never enter the simulated curve.
- Theater is post-hoc, not a pipeline station, produces nothing the pipeline consumes.
- cwd must be the repo root before any call.

## Station 1, insight

Before this call, when `brand/<pack>/` exists, read `brand.md` and `history.md` and paste
their content, or a tight excerpt of the voice section and the three on-brand checks, into
the prompt's brand block below, so the one-shot `codex exec` call carries the gate with it.

```bash
codex exec --skip-git-repo-check - <<'PROMPT' > /tmp/insight.json
The seed does not have to be a news moment. A raw idea, a product, or an insight works
the same way: extract its core tension first, then split.

You crack a moment into 3 creative variants that fit the "existing asset x one new
element" formula.

Formula rules:
1. asset must be something the audience already owns or already recognizes. It can only
   be one of two shapes: "thing" (a concrete object the audience already owns) or
   "interaction" (a concrete interaction the audience already knows how to do).
2. newElement is the single new variable -- the one thing that grafts the moment's core
   tension onto the asset.
3. Nothing about the asset itself may be redesigned except the newElement graft -- it
   must stay fully recognizable.
4. angle is a one-sentence description of this variant's hook logic.
5. angleType must be exactly one of three values, and it decides which distribution-curve
   family this variant gets: "moment" (trend-riding, attention decays fast), "evergreen"
   (doesn't depend on topical heat, settles into steady durable reach), "ugc-loop" (a UGC
   loop -- gets reused/remixed wave after wave, compounding).
6. workingTitle is a working codename of 5 words or fewer.
7. Every variant must clear brand.md's three on-brand checks, restraint, register, rights,
   when a brand block is provided below. A concept that would need a named real person's
   likeness or a named copyrighted property fails the rights check. Rewrite that concept
   around a generalized stand-in that keeps the underlying moment's tension instead of
   dropping the variant outright.

brand block (voice, track record, on-brand checks, or "none" when no brand pack exists):
<pasted brand.md and history.md content, or excerpt>

moment: "<moment>"
wave <N>.
Winning traits from the previous wave, if any (extend these while keeping the formula
rules intact): <output of `node scripts/machine.mjs learn get`, or "none">
If winning traits were injected: the variant whose angleType matches the previous winner
is the defender and extends them; of the other two, at least one is the challenger and
must break from the inherited traits on at least one dimension (a different assetKind,
or a hook family the library has not yet crowned). Exploit with the defender, explore
with the challenger, every wave, no exceptions.

Output strict JSON, nothing outside it:
{"variants":[{"id":"v1","asset":"...","assetKind":"thing|interaction","newElement":"...","angle":"...","angleType":"moment|evergreen|ugc-loop","workingTitle":"..."}, ...3 total, one of each angleType]}
PROMPT
```

Parse `/tmp/insight.json` into the 3 `Variant` objects. Every later station consumes them.

## Station 2, brief

Before each call below, open `references/<channel>.md` for the target channel, or
`references/cross-channel.md` when no channel is set yet, and pull one live source card
entry or, failing that, an entry from the starter rules section, to paste into the
reference block. Tag it with its source and its verification status, `live` or
`starter-unverified`.

Run once per variant (3 calls):

```bash
codex exec --skip-git-repo-check - <<PROMPT > /tmp/brief-v{N}.json
Input is a creative variant that already satisfies the "existing asset x one new element"
formula; compress it into a one-page executable brief.

generationPrompts is the most important deliverable of this station -- it must be a
"ready to run as-is" complete prompt, not a summary, not an outline:
- image: a complete image-generation prompt, including composition/lighting/style/subject detail.
- motion: a complete motion-script prompt, explicitly tagged "for ChatCut", explaining the shot logic.
- copy: a complete copy-generation prompt, specifying tone/length/key points.

reference block (channel winners pulled for this brief, or "none" when no reference exists):
<pasted references entry, tagged with source and status>

moment: "<moment>"
variant: <the Variant JSON object>

Output strict JSON, nothing outside it:
{"audience":"...","insight":"...","assetXElement":"...","formats":["still","motion"],"successMetric":"...","referenceSet":[{"source":"...","entry":"...","status":"live|starter-unverified"}],"generationPrompts":{"image":"...","motion":"...","copy":"..."}}
PROMPT
```

Copy each result to `waves/wave-{NN}/brief-v{N}.json` using the `Brief` shape plus
`referenceSet` (add `variantId` and `workingTitle` from the source variant, they are not
part of the model's output). `referenceSet` is a Codex-CLI-mode and skill-mode addition
written directly into the JSON file, the compiled `Brief` type in `src/types.ts` still
carries only the original fields, this lane does not touch `src/`.

## Station 3, naming (scripted)

Identical to `SKILL.md`:

```bash
node scripts/machine.mjs name <<'EOF'
{"moment":"<moment>","waveNumber":<N>,"variants":[<3 Variant objects>],"audienceByVariant":{"v1":"...","v2":"...","v3":"..."}}
EOF
```

Returns 6 `NamedAsset` objects (still + motion per variant).

## Station 4, plan (scripted)

```bash
node scripts/machine.mjs plan <<'EOF'
{"moment":"<moment>","waveNumber":<N>,"variants":[<3>],"namedAssets":[<6>]}
EOF
```

Writes `plan.json`, returns the `Plan` object.

## Station 5, produce (codex exec for image; copy/motion are also codex exec calls here)

**Copy**, once per asset:

```bash
codex exec --skip-git-repo-check - <<PROMPT
You are a copy generator. Output exactly one line of copy per this prompt, in English,
with no explanation and no surrounding quotes:
<brief.generationPrompts.copy>
PROMPT
```

**Motion assets**: write the 3-shot storyboard directly from `brief.generationPrompts.motion`
(shot 1 establish, shot 2 contrast, shot 3 land the hook), this never needs a model call,
it is a fixed template shape. `assetPath` stays `null`.

**Still assets**, the one real generation call in the pipeline. Before this call, when a
brand pack exists, fold the matching register's prompt fragment from
`brand/<pack>/design.md`'s "Prompt fragments" section into `brief.generationPrompts.image`,
picking dark gradient, diagram accent, paper-white, or UGC by what the brief's register
already calls for. When a later channel cut (station 8b) carries `nativeFormat: ugc-still`,
also splice in the UGC syntax from `references/meta.md`'s starter rules before generating
that channel's image. When a later channel cut is a `tiktok` `video` script, self-check the
three-shot script against `references/tiktok.md`'s starter rules before it ships:

```bash
codex exec --skip-git-repo-check - <<PROMPT
Generate an image with your image generation tool and save it to waves/wave-{NN}/assets/{NamedAsset.name}.png :
{brief.generationPrompts.image, fragment-augmented per the brand pack above}
PROMPT
```

Read the resulting PNG and self-check: subject matches the brief, composition is
coherent, no garbled text, no watermark. Retry the prompt once on failure; if it still
fails, ship it and flag the defect in the judge station's notes. If `codex` is not
installed or not authenticated, skip the image call, set `assetPath` to `null`, and hand
`brief.generationPrompts.image` to the user instead of failing the wave.

Build a `ProducedAsset` per named asset: `{variantId, format, name, assetPath, copy,
motionScript, imageModelUsed, regeneratedCount}`.

## Station 6, judge

Before each call, when a brand pack exists, paste `brand.md`'s three on-brand checks,
restraint, register, rights, into the brand block below.

Run once per produced asset:

```bash
codex exec --skip-git-repo-check - <<PROMPT > /tmp/judge-{name}.json
You are a strict asset referee. Given the brief and the actual produced copy / image
prompt / storyboard, score the asset on a 3-point scale: 1 = fail, 2 = pass, 3 =
excellent. Four dimensions:
- onBrief: did it faithfully execute the brief's assetXElement and insight.
- legible: can the audience understand what's happening within one second.
- shareable: does the audience feel an urge to share/remix it.
- brandFit: score how well the asset clears the three on-brand checks below. Score this
  dimension 2 by default when the brand block reads "none".

brand block (on-brand checks, or "none" when no brand pack exists):
<pasted brand.md checks>

brief: <Brief JSON>
produced: <{copy, motionScript, name} from the ProducedAsset>

Output strict JSON, nothing outside it:
{"onBrief":1|2|3,"legible":1|2|3,"shareable":1|2|3,"brandFit":1|2|3,"notes":"..."}
PROMPT
```

Scoring anchors for `onBrief`/`shareable` (the two most subjective dimensions), same as
`SKILL.md`'s station 6: `onBrief` 1 asset and newElement never fuse, 2 both present but
stitched-on, 3 fuse into one inseparable line (wave 5's `..._THER_MERCUR_PEOP_V05`,
"your chat history"). `shareable` 1 accurate but inert, 2 one relatable beat (wave 4's
`..._THEC_THEWED_ANYO_V04`, "your parents' wedding photo"), 3 a ready-made caption for the
viewer's own post (wave 1's measured SCALE winner `..._GRAF_THEWOR_ANAU_V01`, "your selfie").

Any dimension scoring `1` is a fail, `brandFit` included. On a fail, regenerate that one
asset once (rerun its produce step), score the regenerated version, and stop regardless of
the second result, at most one retry. Build a `JudgeResult`: `{variantId, format, score,
passed, regenerated, notes}`, where `score` carries all four dimensions above including
`brandFit`. `brandFit` is a first-class optional field on the compiled `JudgeScore` type in
`src/types.ts`; the headless CLI judge scores it too when `BRAND_PACK` is set, so every mode
carries the same score shape.

## Station 7, simulate (scripted)

```bash
node scripts/machine.mjs simulate <<'EOF'
{"namedAssets":[<6>],"variants":[<3>],"days":<plan.dates.days>,"waveNumber":<N>}
EOF
```

Returns 3 `SimulatedCurve` objects (still assets only).

## Station 8, decide (scripted)

```bash
node scripts/machine.mjs decide <<'EOF'
{"simulated":[<3>],"plan":<Plan>}
EOF
```

Returns 3 `Decision` objects (SCALE / KILL / ITERATE).

## Station 8b, rollout (codex exec, only for SCALE verdicts)

Skip this station entirely for any `KILL` or `ITERATE` decision, there is nothing to roll
out. A channel cut is an expansion arm off a concept that already won the wave, not a new
idea: every channel still earns its own SCALE or KILL verdict against its own kpi below,
separate from the concept-level test the `WEB` name already ran.

**The deliverable contract**, same as `SKILL.md`'s: a video channel means a real rendered
video off real image-to-video generation (the `libtv-skill`, never a `zoompan` fake-motion
trick), ffmpeg only assembles it (vertical crop, drawtext, trim/concat); every channel ships
a `postKit: {file, caption, hashtags, altText, postingNote}`; a `ugc-loop` concept's
`RolloutDraft` carries a `participationKit: {mechanic, creatorShotList, seedCaptions,
creditRule}` instead of relying on a faked UGC still, and any `ugc-still` channel cut that
does still get generated for a `ugc-loop` concept carries
`illustrativeLabel: "template preview, illustrative"`.

Before this call, when a brand pack exists, read `brand/<pack>/channels.md` for the actual
channel precedent, what fits and what does not fit, per channel, and paste it into the
channel block below so the pick stays inside precedent, or the deviation gets stated
plainly inside `assetSpec`. Also paste `brand.md`'s register check into the same block so
`channelCopy` stays dry and specific to the moment rather than generic internet slang. For
each `SCALE` decision, run one `codex exec` call:

```bash
codex exec --skip-git-repo-check - <<PROMPT > /tmp/rollout-{name}.json
You are the rollout station of The Growth Machine. You run only for a variant that
already earned a SCALE verdict.
Write a channel by channel playbook for the winning asset. Pick 2 to 4 relevant channels,
weighted toward the channels the brand pack shows are proven. Prefer channels the channel
block below shows fit for this concept.
Every field is a plain declarative sentence. Do not use an em dash or an en dash anywhere
in the output.
Each channel is an expansion arm off a concept that already won, not a new idea: it will
earn its own SCALE or KILL verdict against the kpi you write below, separate from the
concept-level test.
role must be exactly one of: discovery, amplification, retention, conversion.
executionSteps must have 3 to 4 entries, each one action sentence.
kpi is one concrete number tied to an outcome. kpiThresholdNote is one sentence linking
that number back to the plan's preregistered threshold system.
channelCopy is one line of finished, ready to ship ad copy written in that channel's
native voice: tiktok terse and punchy, instagram a colloquial creator caption, x
conversational, an in-app surface a one tap prompt. Keep the tone aligned with the register
check in the brand block below.
Format follows the channel: a video channel ships a three shot script plus a cover frame,
a ugc channel ships a candid creator still, an editorial channel ships a native still, an
in-product surface ships a mask safe crop. Write assetSpec accordingly.
A channel cut is a re-expression, not a resize: no two channels may ship what reads as the
same image reformatted. Keep the concept and the lineage name, re-author the creative form
in each channel's native grammar (x text-forward and conversational, instagram creator-
aesthetic grid material, in-app a functional UI-true crop). Self-check: would this brand's
channel manager post this, natively, today? Duplicates get re-authored.

channel block (channel precedent and register check, or "none" when no brand pack exists):
<pasted channels.md fit/anti-fit notes and brand.md register check>

variant: <winning Variant JSON>
brief: <Brief JSON>
decision: <Decision JSON>
named asset: <NamedAsset.name of the still that scaled>
thresholds: <plan.preRegisteredThresholds[variant.angleType]>

Output strict JSON, nothing outside it:
{"variantId":"...","name":"...","channels":[{"channel":"...",
"role":"discovery|amplification|retention|conversion","assetSpec":"...",
"executionSteps":["...","...","..."],"kpi":"...","kpiThresholdNote":"...",
"channelCopy":"..."}],"participationKit":null}
Do not include assetName, assetPath, coverPath, videoDurationSec, illustrativeLabel,
nativeFormat, channelScript, or postKit, those are assigned after this output validates. If
the winning variant's angleType is ugc-loop, replace participationKit's null with
{"mechanic":"...","creatorShotList":["...","...","..."],"seedCaptions":["...","...","..."],"creditRule":"..."}
following the creatorShotList discipline in references/meta.md's Tier 1 corpus: cold open
already in progress, one clear beat held long enough to register, a casual verbal moment
over a polished tag-on.
PROMPT
```

Stamp `assetName` onto every channel before validating: take the winning still's
`NamedAsset.name` and swap only its `CHANNEL` segment for this channel's token
(`instagram` -> `IG`, `tiktok` -> `TT`, `x` -> `XTW`, `in-app profile surface` -> `APP`, an
unlisted channel gets a slugged 3-char code), inheriting the other eight segments verbatim.
Stamp `nativeFormat` too, format follows the channel: `tiktok` -> `video`, `instagram` ->
`ugc-still`, `x` -> `still`, `in-app profile surface` -> `surface`, an unlisted channel
defaults to `still`. For a `video` channel write `channelScript`, a ChatCut-ready three-shot
script whose shot 3 lands the channelCopy; every other format carries `channelScript: null`.
Stamp `illustrativeLabel: "template preview, illustrative"` on a `ugc-still` channel when
the winning variant's `angleType` is `ugc-loop`, `null` otherwise. Set `assetPath` and
`coverPath` to `null` and `videoDurationSec` to `null` for now, they are filled in once real
generation runs below. Build `postKit` per channel now too: `file` is
`{assetName}.mp4` for a `video` channel or `{assetName}.png` otherwise, `caption` is 2 to 3
sentences in the channel's native voice, `hashtags` is 3 to 6 entries, `altText` describes
what is on screen, `postingNote` covers when to post and what to pin. Pipe the completed
object straight through the validator before it goes anywhere near `readout.json`:

```bash
node scripts/machine.mjs rollout-validate < /tmp/rollout-{name}.json
```

Returns `{"ok":true}` or `{"ok":false,"errors":["..."]}`. On a failure, re-run the `codex
exec` call with the error list appended to the prompt, revalidate, at most one retry, same
ceiling the judge station enforces.

**Produce the channel cut.** Once a draft validates, produce every channel's real
deliverable, following `nativeFormat`: one `codex exec` image call for `ugc-still`/`still`/
`surface`, or real image-to-video generation (the `libtv-skill`) plus ffmpeg assembly
(crop/drawtext/trim only, it never originates motion) for `video`. Full step-by-step
contract for both, including the exact prompts, commands, and self-checks, lives in
`skill/references/rollout-video.md`, read it before producing any channel cut.

Collect one `RolloutDraft` per `SCALE` verdict into `readout.rollouts`.

## Report, assemble and render (scripted)

Assemble the `WaveReadout` (same shape as `SKILL.md`'s Report section) and run:

```bash
node scripts/machine.mjs report <<'EOF'
{"readout": <WaveReadout object>}
EOF
```

Writes `readout.json` and `report.html`, returns both paths.

## Station 9, learn (scripted)

```bash
node scripts/machine.mjs learn commit <<'EOF'
{"waveNumber":<N>,"moment":"<moment>","variants":[<3>],"namedAssets":[<6>],"decisions":[<3>]}
EOF
```

Appends the wave's line to `library.jsonl`. Its `learnings` string is what the next wave's
`codex exec` insight call above should paste into the "Winning traits from the previous
wave" slot.

## Continuing a moment

```bash
node scripts/machine.mjs learn last
```

Returns `{"moment": "...", "lastWave": N}` or `null`. Use `lastWave + 1` as the new wave
number, the same moment string, and run stations 1 through 9 again.

## Measure (unchanged, post-hoc)

Not part of the loop above, call the standalone CLI directly:

```bash
./bin/growth-machine measure --wave <N> --file metrics.json
```

## Theater, the showing (post-hoc, not a pipeline station, scripted)

Not an eleventh station, produces nothing the loop above consumes. Once a wave has shipped
`readout.json`, this replays that real data as a split screen: left, THE WORK, a
station-by-station activity log; right, THE EVIDENCE, real artifact cards (variants, the
nine-segment name, thresholds, stills, judge scores, the curve race, the rollout) lighting
up alongside the log line that produced them, "every frame is evidence." Nothing is
invented, every card traces to a `WaveReadout` field. A material tile plays its own rollout
footage in place when clicked, never before.
No `codex exec` call needed, same scripted stage as naming/plan/simulate/decide:

```bash
node scripts/machine.mjs theater <<'EOF'
{"readout": <the WaveReadout object from Report above>}
EOF
```

Writes `waves/wave-{NN}/theater.html`. `machine.mjs theater-live <N>` is the
watching-it-happen twin, generated at wave start, polling the wave dir instead of a finished
readout. `scripts/record-theater.mjs` is an optional export tool, not part of this flow: it
drives a real Chromium tab through `theater.html` and captures the replay to
`theater-waveNN.mp4` for whoever wants a video file to hand around.

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
