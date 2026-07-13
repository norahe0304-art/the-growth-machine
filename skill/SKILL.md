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
[INPUT]: the agent's own reasoning (insight/brief/judge/rollout-authoring stations,
  stdin-free, the agent writes the JSON itself) + scripts/machine.mjs (naming/plan/simulate/
  decide/rollout-validate/report/learn, stdin-JSON-in/stdout-JSON-out) + codex exec GPT-Image
  (produce's image call, optional) + bin/growth-machine measure (measure station, unchanged,
  post-hoc)
[OUTPUT]: waves/wave-NN/{brief-v1.json, brief-v2.json, brief-v3.json, plan.json,
  assets/*.png, readout.json, report.html} + one appended library.jsonl line per wave
[POS]: the skill-layer twin of bin/growth-machine, same ten files in src/, same six
  conceptual stations plus rollout's conditional station 8b, same taxonomy, same thresholds.
  The only thing that changes between CLI mode and skill mode is who calls the LLM stations:
  a paid OpenAI API key in CLI mode, the agent's own weights in skill mode. See CODEX.md for
  the Codex CLI equivalent of this
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

Check `brand/<pack>/` for a brand pack, default pack is `openai`. When the directory
exists, Read all four files, `brand.md`, `design.md`, `channels.md`, `history.md`, and
hold them in memory for the whole wave, several stations below need them. Check
`references/` for the channel winners libraries too, and pull the file that matches the
target channel, or `cross-channel.md` when no channel is set yet, at whichever station
below calls for it.

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

Also before generating, read `brand/<pack>/brand.md` for voice and stance and
`brand/<pack>/history.md` for the track record and its four laws, when the pack exists.
Every variant this station produces must clear all three on-brand checks in `brand.md`'s
closing section, restraint, register, rights, before it moves to station 2. A concept that
would need a named real person's likeness or a named copyrighted property to work fails the
rights check right here. Rewrite that concept around a generalized stand-in that keeps the
underlying moment's tension instead of dropping the variant outright.

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
> Before writing the prompt, open `references/<channel>.md` for the target channel, or
> `references/cross-channel.md` when no channel is set yet at brief time. Pull one live
> source card entry when a live pull is available, otherwise fall back to that file's
> starter rules section. `referenceSet` names what got pulled, each entry tagged with its
> source and its verification status, `live` or `starter-unverified`.
>
> Output shape: `{"audience":"...","insight":"...","assetXElement":"...","formats":["still","motion"],"successMetric":"...","referenceSet":[{"source":"...","entry":"...","status":"live|starter-unverified"}],"generationPrompts":{"image":"...","motion":"...","copy":"..."}}`

Write one `brief-v{N}.json` per variant to `waves/wave-{NN}/brief-v{N}.json` (zero-padded
wave number, matching `waveDirName`, e.g. `waves/wave-01/brief-v1.json`). Use the `Brief`
shape plus `referenceSet`: `{variantId, workingTitle, audience, insight, assetXElement,
formats, successMetric, referenceSet, generationPrompts}`. `referenceSet` is a
skill-mode and Codex-CLI-mode addition written directly into the JSON file, the compiled
`Brief` type in `src/types.ts` still carries only the original fields, this lane does not
touch `src/`.

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

**Still assets**: this is the one real generation call in the whole pipeline. Before calling
`codex`, when a brand pack exists, fold the matching register's prompt fragment from
`brand/<pack>/design.md`'s "Prompt fragments" section into `brief.generationPrompts.image`,
picking dark gradient, diagram accent, paper-white, or UGC by what the brief's register
already calls for. When a later channel cut (station 8b) carries `nativeFormat: ugc-still`,
also splice in the UGC syntax from `references/meta.md`'s starter rules before generating
that channel's image. When a later channel cut is a `tiktok` `video` script, self-check the
three-shot script against `references/tiktok.md`'s starter rules before it ships. If `codex`
is installed and authenticated, run it against the (possibly fragment-augmented)
`brief.generationPrompts.image`:

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
> excellent. Four dimensions:
> - `onBrief`: did it faithfully execute the brief's `assetXElement` and `insight`.
> - `legible`: can the audience understand what's happening within one second.
> - `shareable`: does the audience feel an urge to share/remix it.
> - `brandFit`: when a brand pack exists, read `brand/<pack>/brand.md`'s three on-brand
>   checks, restraint, register, rights, and score how well the asset clears all three.
>   When no brand pack exists, score this dimension `2` by default.
>
> Output shape: `{"onBrief":1|2|3,"legible":1|2|3,"shareable":1|2|3,"brandFit":1|2|3,"notes":"..."}`

Any dimension scoring `1` counts as a fail, `brandFit` included. On a fail, regenerate that
one asset once (rerun the produce step for it, new copy, or a retried `codex exec` for
stills), then score the regenerated version and stop regardless of the second result, at
most one retry, same rule `runJudge` enforces. Build a `JudgeResult` per asset: `{variantId,
format, score, passed, regenerated, notes}`, where `score` carries all four dimensions
above including `brandFit`. `brandFit` is a skill-mode and Codex-CLI-mode addition written
directly into the JSON the agent produces. The compiled `JudgeScore` type in `src/types.ts`
still carries only the original three dimensions, this lane does not touch `src/`, so the
skill and CLI headless modes carry different score shapes until a later lane wires
`brandFit` into the compiled type.

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

## Station 8b, rollout (you are the model, then real generation produces the channel cuts)

Runs only for a `SCALE` verdict. `KILL` and `ITERATE` assets skip this station entirely,
there is nothing to roll out. A channel cut is an expansion arm off a concept that already
won the wave, not a new idea: every channel still earns its own SCALE or KILL verdict
against its own kpi below, separate from the concept-level test the `WEB` name already ran.

**The deliverable contract.** Three rules govern everything this station ships, ahead of
the prompt contract and the schema below:

1. **A video channel means a real rendered video, not a still with a script.** The motion
   comes from real image-to-video generation off the winning concept still (the
   `libtv-skill`, liblib.tv's image-to-video capability, see "Real video, step by step"
   below), never from a pan-and-zoom (`zoompan`) fake-motion trick on a static image. ffmpeg
   is the assembly worker only: vertical crop, text compositing, trim/concat. It never
   originates the motion itself.
2. **Every channel ships a `PostKit`, not just an asset.** `postKit: {file, caption,
   hashtags, altText, postingNote}` is required on every `RolloutChannelPlan`, still or
   video, and rendered into `report.html` alongside the asset. A channel cut without a post
   kit is not a finished deliverable, it is a half-shipped asset with nowhere to post it.
3. **A ugc-loop concept gets a `ParticipationKit`, never a faked UGC image standing in for
   one.** When the winning `Variant.angleType` is `"ugc-loop"`, the `RolloutDraft` carries
   `participationKit: {mechanic, creatorShotList, seedCaptions, creditRule}`, the real "how
   real users participate" mechanism. An AI-generated `ugc-still` channel cut may still ship
   as an illustration of the mechanic, but it must carry
   `illustrativeLabel: "template preview, illustrative"` and must never be presented as if
   it were real user-submitted content.

Before picking channels, when a brand pack exists, read `brand/<pack>/channels.md` for the
actual channel precedent, what fits and what does not fit, per channel. Pick from the
channels the file shows fit for this concept, or state the deviation plainly inside
`assetSpec` when a channel outside precedent is genuinely warranted. Write `channelCopy` in
that channel's native voice per the prompt contract below, and keep its tone aligned with
`brand.md`'s register check, dry and specific to the moment, never generic internet slang.

For each `SCALE` decision, write a `RolloutDraft`: a channel by channel playbook for how the
winner actually goes out, following this prompt contract verbatim:

> You are the rollout station of The Growth Machine. You run only for a variant that
> already earned a SCALE verdict.
> Write a channel by channel playbook for the winning asset. Pick 3 to 4 relevant channels,
> for example tiktok, instagram, x, or an in-app profile surface.
> Every field is a plain declarative sentence. Do not use an em dash or an en dash anywhere
> in the output.
> Each channel is an expansion arm off a concept that already won, not a new idea: it will
> earn its own SCALE or KILL verdict against the kpi you write below, separate from the
> concept-level test.
> `role` must be exactly one of: discovery, amplification, retention, conversion.
> `executionSteps` must have 3 to 4 entries, each one action sentence.
> `kpi` is one concrete number tied to an outcome. `kpiThresholdNote` is one sentence
> linking that number back to the plan's preregistered threshold system.
> `channelCopy` is one line of finished, ready to ship ad copy written in that channel's
> native voice: tiktok terse and punchy, instagram a colloquial creator caption, x
> conversational, an in-app surface a one tap prompt.
> Format follows the channel: a video channel ships a three shot script plus a cover frame,
> a ugc channel ships a candid creator still, an editorial channel ships a native still, an
> in-product surface ships a mask safe crop. Write `assetSpec` accordingly.
>
> Output shape: `{"variantId":"...","name":"...","channels":[{"channel":"...",
> "role":"discovery|amplification|retention|conversion","assetSpec":"...",
> "executionSteps":["...","...","..."],"kpi":"...","kpiThresholdNote":"...",
> "channelCopy":"..."}]}`

Feed yourself the winning `Variant`, its `Brief`, the `Decision` that scaled it, the still
asset's `NamedAsset.name`, and `plan.preRegisteredThresholds[variant.angleType]`, the same
inputs `runRollout` takes in CLI mode. `assetSpec` is one sentence: format, ratio, and how
the hook changes for that channel. `kpi` should read against the thresholds you were just
handed, always a real number pulled from that table.

Do not write `assetName`, `assetPath`, `coverPath`, or `videoDurationSec` yourself,
`assetName` is a deterministic lineage swap, not a model decision, the rest are filled in
after real generation runs below. For each channel, take the winning still's
`NamedAsset.name` (nine segments, `CHANNEL_OBJ_FUNNEL_TEMP_FORMAT_HOOK_MOMENT_PERSONA_VER`)
and swap only the `CHANNEL` segment for this channel's token: `instagram` -> `IG`, `tiktok`
-> `TT`, `x` -> `XTW`, `in-app profile surface` -> `APP` (an unlisted channel gets a slugged
3-char code, same shape `taxonomy.channelToken` falls back to). The other eight segments are
inherited verbatim, same asset, new channel.

**Format follows the channel.** `nativeFormat` is a property of the channel, not a model
decision: `tiktok` -> `video`, `instagram` -> `ugc-still`, `x` -> `still`, `in-app profile
surface` -> `surface` (an unlisted channel defaults to `still`). Stamp it on every channel
entry. For a `video` channel also write `channelScript`: a ChatCut-ready three-shot script,
shot 1 establishes the winning subject in its everyday context, shot 2 lands the new element
as a visual break, shot 3 locks the `channelCopy` in as on-screen copy and holds the frame.
Every other `nativeFormat` carries `channelScript: null`. Stamp `illustrativeLabel:
"template preview, illustrative"` on a `ugc-still` channel when `variant.angleType` is
`"ugc-loop"` (the image stands in for real user content that does not exist yet); `null` for
every other channel.

**Write the `PostKit` for every channel.** `postKit: {file, caption, hashtags, altText,
postingNote}` is required on every channel regardless of `nativeFormat`: `file` is the path
the asset lands at once produced (`.mp4` for a video channel, `.png` for every other
format), `caption` is 2 to 3 sentences in that channel's native voice, `hashtags` is 3 to 6
entries with no filler, `altText` describes what is on screen for accessibility,
`postingNote` is one sentence covering when to post, who to tag, what to pin.

**Write the `ParticipationKit` when this concept is `ugc-loop`.** If `variant.angleType ===
"ugc-loop"`, also write `participationKit: {mechanic, creatorShotList, seedCaptions,
creditRule}` at the `RolloutDraft` level (once per draft, not once per channel):
`mechanic` is one sentence naming what a real user actually does to participate;
`creatorShotList` is 3 to 4 real-phone shot instructions for a real creator, styled after
`references/meta.md`'s Tier 1 corpus (Nora's own `30x-product-to-ugc` scoring pass, roughly
1100 Meta Ad Library entries distilled into 38 house rules): cold open on the thing already
in use, no setup shot, one clear beat held long enough to register rather than a fast
montage, a casual verbal moment rather than a polished tag-on; `seedCaptions` is exactly 3
ready-to-use captions handed to real users, written as a testimonial a real person would
say, not ad copy; `creditRule` is one sentence on how credit passes from one participant to
the next, this is what turns single posts into a loop. For every other `angleType`, set
`participationKit: null`.

Write down what you drafted before you touch anything else, then pipe that exact JSON
through the validator before it goes anywhere near `readout.json`:

```bash
node scripts/machine.mjs rollout-validate <<'EOF'
{"variantId":"...", "name":"...", "channels":[ ... ], "participationKit": null}
EOF
```

Returns `{"ok":true}` on a clean draft, or `{"ok":false,"errors":["..."]}` naming the exact
field that failed: wrong channel count, an invalid `role`, a missing field, an em or en
dash, an `assetName` whose `CHANNEL` segment doesn't match its `channel`, a `nativeFormat`
that doesn't match its channel, a video channel missing its three-shot script or its
`coverPath`, a video channel carrying `videoDurationSec` without a rendered `assetPath`, a
missing or malformed `postKit`, a malformed `participationKit`. Fix the draft and revalidate
until it passes.

**Produce the channel cut.** Once a draft validates, every channel gets its real
deliverable, following `nativeFormat`:

- `ugc-still`, `still`, `surface`: one real image generation call, the same posture station
  5 takes for the concept-level still. Apply the same brand-pack and reference rules station
  5 sets: fold `design.md`'s matching prompt fragment into the adapted image prompt, splice
  in `references/meta.md`'s UGC syntax for a `ugc-still` channel. If `codex` is installed and
  authenticated:

  ```bash
  codex exec --skip-git-repo-check - <<PROMPT
  Generate an image with your image generation tool and save it to
  waves/wave-{NN}/assets/rollout/{assetName}.png :
  {brief.generationPrompts.image} Adapt for the channel's native format: {assetSpec}.
  Use the winning concept image at waves/wave-{NN}/assets/{winning NamedAsset.name}.png as
  the visual anchor, same subject, same graft. No text of any kind baked into the image,
  any hook line ships as a caption or a drawtext overlay, never rendered into the pixels.
  Format treatment by nativeFormat: ugc-still, a 1:1 still that reads as shot on a phone,
  candid light, creator aesthetic, not retouched, not staged; still, a 16:9 editorial still
  with the graft visible, no hook text baked in; surface, a 1:1 crop safe inside a circular
  mask.
  PROMPT
  ```

  Then `Read` the resulting PNG and self-check: same subject and graft as the winning
  concept image, correct ratio and format treatment for that channel, no garbled text, no
  watermark, no baked-in text of any kind. If it fails, retry the prompt once; if it still
  fails, ship it anyway, set `assetPath` to `null`, and note the defect directly to the
  user, same one-retry ceiling every other generation call in this pipeline enforces. If
  `codex` is not installed or not authenticated, leave `assetPath` as `null` and hand the
  rewritten prompt to the user.

- `video`: two real steps, never a single fake-motion shortcut.

  **Step 1, real video, image to video generation.** Use the `libtv-skill`
  (`~/.claude/skills/libtv-skill/SKILL.md`, liblib.tv's image-to-video capability) off the
  winning concept still, `waves/wave-{NN}/assets/{winning NamedAsset.name}.png`:

  ```bash
  python3 {libtv-skill baseDir}/scripts/upload_file.py waves/wave-{NN}/assets/{winning NamedAsset.name}.png
  # -> ossUrl
  python3 {libtv-skill baseDir}/scripts/create_session.py "根据参考图生成一段自然的动作视频：{one-sentence description of the natural motion this asset should carry, in the moment's own language, no camera jargon}。参考图：{ossUrl}"
  # -> sessionId, projectUuid
  # poll every 8s: python3 {libtv-skill baseDir}/scripts/query_session.py SESSION_ID --after-seq N
  # download once an assistant message carries a video URL:
  python3 {libtv-skill baseDir}/scripts/download_results.py SESSION_ID --output-dir waves/wave-{NN}/assets/rollout --prefix {assetName}_raw
  ```

  Per the libtv-skill's own operating rule, pass the user's (or this station's) motion
  description through untouched, do not author elaborate cinematography language on top of
  it, the backend agent already handles shot design. If `LIBTV_ACCESS_KEY` is unset or the
  service is unavailable, do not fabricate motion with `zoompan` or any other pan-and-zoom
  trick on the still: leave `assetPath` and `videoDurationSec` as `null`, note the blocker
  directly to the user, and stop this channel's video step there, the rest of the wave still
  ships.

  **Step 2, ffmpeg assembly, text and framing only.** ffmpeg's job here is strictly
  mechanical: crop the raw i2v output to 9:16 if it was not already generated vertical, then
  composite `channelCopy` (or the brief's hook line) as a `drawtext` overlay timed to the
  shots, then trim to the target duration. ffmpeg never originates motion in this step, the
  motion already exists in the file from step 1. Also render a **no-text cover frame**
  (a single extracted frame from the raw i2v output, no drawtext applied) and save it to
  `coverPath`, this is what `report.html` shows as the still preview next to the rendered
  video. Self-check by extracting 2 to 3 frames from the assembled mp4 (`ffmpeg -ss ... -frames:v 1`)
  and `Read`-ing them: text legible and not clipped, no garbled characters, motion reads as
  natural (no limb warping, no ghosting artifacts) at the sampled timestamps. If the i2v
  output itself shows broken anatomy or ghosting, retry the image-to-video generation once
  with an adjusted motion description before falling back to a null `assetPath`.

  Set `assetPath` to the assembled mp4's path and `videoDurationSec` to its real duration
  once both steps succeed. If either step is unavailable or fails twice, leave `assetPath`
  and `videoDurationSec` as `null`, keep `coverPath` pointing at whatever no-text cover
  frame exists (extracted from a successful i2v raw output, or a codex-generated still if
  i2v never ran), and note the gap to the user instead of failing the rollout.

For every channel whose `nativeFormat` is not `video`, fill `postKit.file` with the produced
image path once `assetPath` is set. For a `video` channel, `postKit.file` is the assembled
mp4's path once it exists (or the planned filename while `assetPath` is still `null`).

Once every channel is produced, build one `RolloutDraft` per `SCALE` verdict this wave (zero
if nothing scaled) and collect them into `readout.rollouts`.

## Report, assemble and render

Assemble the full `WaveReadout`:

```json
{
  "moment": "<moment>", "waveNumber": <N>,
  "variants": [<3>], "briefs": [<3>], "namedAssets": [<6>], "plan": <Plan>,
  "produced": [<6 ProducedAsset>], "judged": [<6 JudgeResult>],
  "simulated": [<3 SimulatedCurve>], "decided": [<3 Decision>],
  "measured": [], "rollouts": [<one RolloutDraft per SCALE verdict, from station 8b>],
  "injectedLearnings": "<from learn get, or null>"
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

Report to the user: variant count, assets produced, SCALE/KILL/ITERATE counts, rollout
draft count, and the path to `report.html`.

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
