<!--
[INPUT]: skill/SKILL.md and skill/CODEX.md operator gates + station 1's existing asset x
  one new element formula and three Variant angle types + stations 7 and 8 preregistered
  simulation + station 8b rollout, ParticipationKit, PostKit, and illustrativeLabel rules
[OUTPUT]: the full operator-facing mechanics for the sparks, treatments, and race cards,
  including death tests, lineage backfill, two-vote recording, and theater tenses
[POS]: shared operating reference for the three-card control surface layered over the ten
  stations; SKILL.md and CODEX.md keep only contract highlights and link here
[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
-->

# The three-card operator funnel

The ten stations remain the execution system. This reference defines the operator's three
decision cards over that system. These fields are documentation contracts held by the
orchestrator in the wave's record. They are not new `src/types.ts` shapes, and
`scripts/machine.mjs` does not yet validate them.

## Card 1, sparks

Station 1 runs in two phases. The volume phase creates 10 to 20 raw, unpolished one-line
sparks. No `Variant` exists during this phase. The development phase begins only after the
operator circles 2 to 4 sparks.

Before the volume phase, station 1 runs a trend street-scan against at least one real
source. The allowed source classes are TikTok Creative Center, a platform trend tool, and
an ad library. It writes the observed anchors to
`waves/wave-NN/stage1-anchors.json`. Each anchor records `formatOrMeme`, `heatEvidence`,
`source`, `sourceUrl`, and `date`. The date is the observation date. The source URL points
to the evidence used in that run.

Each in-memory spark uses this documentation shape:

```json
{
  "id": "s01",
  "line": "...",
  "identityAsset": "...",
  "candidateAngleType": "moment|evergreen|ugc-loop",
  "anchor": {
    "formatOrMeme": "...",
    "heatEvidence": "...",
    "source": "...",
    "sourceUrl": "...",
    "date": "YYYY-MM-DD"
  }
}
```

The three death tests run before a spark is admitted to the 10 to 20 item set. A failed
spark is cut before it is written down. Fabricating a format, heat claim, measurement,
source, URL, or date is forbidden.

The operator circles the complete spark objects, not fragments of their wording. Only the
circled lineage may feed development. The circled set yields exactly 3 `Variant` objects,
one each for `moment`, `evergreen`, and `ugc-loop`. Development uses the existing asset x
one new element formula without changing its fields or constraints.

When the circled set lacks one or more angle types, station 1 extends or branches the
closest circled lineage until all three types exist. It never imports an uncircled spark or
invent a separate idea. Every resulting backfill carries
`completionLabel: "machine-completed"` as an optional in-memory field on `Variant`.
Operator-derived variants omit `completionLabel`. This optional field is not yet validated
by a script.

If the operator rejects the set, station 1 discards the full 10 to 20 spark batch. It folds
the operator's feedback into a new street-scan and fresh split. It does not retain the
sparks that were not individually criticized. This mirrors the existing operator gate for
a rejected variant set. The orchestrator appends this record to
`operatorFunnel.sparkBatches` in the wave's record:

```json
{
  "batchId": "spark-batch-01",
  "sparks": ["<the complete rejected spark objects>"],
  "circledSparkIds": ["s02", "s07"],
  "status": "rejected",
  "operatorFeedback": "..."
}
```

### Worked lineage example

This example is invented to explain the control flow. It is not project history and its
anchor evidence must not be copied into a live wave.

The operator circles `s02`, a `moment` spark based on the operator's own recurring phrase,
and `s07`, a `ugc-loop` spark based on the same phrase. The set lacks an `evergreen` angle.
Station 1 branches `s02` into an evergreen treatment of that phrase, applies the unchanged
asset x one new element formula, and emits three variants. The evergreen variant includes
`completionLabel: "machine-completed"`. The moment and ugc-loop variants omit that field.
No uncircled spark enters the result.

## The three death tests

### The identity-asset test

The `identityAsset` belongs to the operator personally. Eligible material includes the
operator's catchphrase, a family member's actual words, hometown vernacular, or the
operator's own well-known story. It is lived material with a traceable personal owner. A
camera prop, product mockup, interface gesture, visual transition, abstract participation
mechanic, or other device does not pass merely because it is available to shoot.

Example, invented: The operator is known for saying, "Ship the awkward first draft." A
spark that adapts those exact personal words passes. A spark whose entire identity asset is
a red button fails because the button is a prop, not personal identity material.

### The one-second test

The complete one-line spark must communicate its person, identity asset, and twist within
one second. It must survive retelling without a deck, product explanation, or setup clause.
A stranger should be able to repeat the idea at a dinner table in one sentence. If the
listener must ask what the mechanic means, the spark fails.

Example, invented: "Your hometown goodbye, rewritten by the AI that knows you stayed"
passes because the identity material and twist are immediate. "A recursive retention loop
using adaptive interface states" fails because it requires an explanation before it can be
retold.

### The anchor test

The street-scan happens before any spark is written. Every admitted spark names the real,
currently-trending format or meme it rides and points to the matching anchor entry. That
entry must contain observable heat evidence, the source, a source URL, and the observation
date. A generic claim that a format feels viral does not count. A missing or inaccessible
source does not count. A spark without a real dated anchor is cut before admission.

Example, illustrative process only: Station 1 observes a format in TikTok Creative Center
on `YYYY-MM-DD`, records the visible rank or growth measure and the exact page URL, and then
names that format in `s03`. The spark passes only after those placeholders contain the real
values observed in that run. It fails if the record says only "trending on TikTok." This
example makes no claim that a particular format or metric is currently trending.

## Card 2, treatments

A concept that survives Card 1 receives one `TreatmentCard`. It does not receive an
AI-generated finished image. The treatment card is a selection artifact that lets the
operator choose the concepts and visual register before production spends begin.

The complete documentation shape is:

```json
{
  "treatmentId": "t01",
  "sparkId": "s02",
  "variantIds": ["v1", "v2", "v3"],
  "anchorReference": {
    "kind": "screenshot|close-approximation",
    "path": "...",
    "source": "...",
    "sourceUrl": "...",
    "capturedAt": "YYYY-MM-DD",
    "usage": "internal-reference-only"
  },
  "treatmentBeats": ["beat one", "beat two", "beat three"],
  "sampleCopy": "...",
  "shootingSpec": {
    "shooter": "...",
    "subject": "...",
    "action": "...",
    "deliverable": "..."
  },
  "cover": {
    "path": "...",
    "illustrativeLabel": "template preview, illustrative"
  }
}
```

`anchorReference` is a direct screenshot of the real viral reference or a close
approximation. It is marked for internal reference use only. `treatmentBeats` contains
exactly three beats that explain how the selected concept adapts the format. `sampleCopy`
contains one line. `shootingSpec` names who shoots what and the expected deliverable. The
cover is the only asset shown at this gate and always carries
`illustrativeLabel: "template preview, illustrative"`.

A treatment card differs from a finished `Brief`. It selects a reference, adaptation, and
shooting register. It does not contain a finished concept image and does not authorize
production. A `Brief` remains the executable station 2 contract with generation prompts,
formats, audience, insight, and success metric.

All AI image generation for the concept occurs after treatment selection in production. A
UGC-format concept defaults to a real `ParticipationKit` plus a real creator shot list. An
AI still never stands in for real user content. It is allowed only when the winning
channel's real deliverable is a static image or when it is explicitly an illustrative
storyboard preview. Station 8b remains authoritative for `ugc-loop`, `ParticipationKit`,
`PostKit`, and `illustrativeLabel` behavior.

## Card 3, the race and channels

Stations 7 and 8 run their preregistered simulation unchanged. Their result is the
machine's evidence vote. The operator then casts the human vote. The wave does not treat
the machine verdict alone as the final verdict.

If the machine returns `SCALE`, the operator may return `KILL`. The final verdict is
`KILL`. That operator kill is final, and the machine cannot revive the asset. If the
machine returns `KILL`, the operator may return `override-kill`. The final verdict is
`SCALE`, and the asset may enter station 8b. These are the two directions of the same
two-vote rule. This contract adds no rule for `ITERATE` beyond the existing station 8
behavior.

The orchestrator appends one entry per asset to `operatorFunnel.verdictVotes` in the wave's
record:

```json
{
  "assetName": "...",
  "machineVerdict": "SCALE|KILL|ITERATE",
  "operatorVote": "accept|kill|override-kill",
  "finalVerdict": "SCALE|KILL|ITERATE",
  "operatorFeedback": "..."
}
```

An operator kill of a machine pass records `machineVerdict: "SCALE"`, `operatorVote:
"kill"`, and `finalVerdict: "KILL"`. An operator override of a machine kill records
`machineVerdict: "KILL"`, `operatorVote: "override-kill"`, and `finalVerdict: "SCALE"`.
These record fields are not yet validated by a script.

A winner enters station 8b under the existing rollout contract. The real-spend gate for
video generation remains mandatory and unchanged. Every channel cut receives its own
verdict. Every `PostKit` requires the operator's final sign-off before it ships.

## The live room's three tenses

`theater-live` is the live broadcast. The stream opens when the wave opens, and the
operator is present to act on the cards in real time.

`theater` is the recorded replay. It is produced after the wave has already shipped.

The `.mp4` file is an optional export cut. It can be assembled from either the live
broadcast or the recorded replay.

All three read the same `WaveReadout` data. Only the tense differs, so each visible claim
remains bound to the same shipped evidence record.
