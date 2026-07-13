<!--
[INPUT]: station 8b's "Produce the channel cut" step in both skill/SKILL.md and
  skill/CODEX.md (every channel of a SCALE-verdict `RolloutDraft`, once its draft has
  validated) + codex exec GPT-Image (image channels) + the `libtv-skill`
  (`~/.claude/skills/libtv-skill/SKILL.md`, liblib.tv's image-to-video capability, video
  channels) + ffmpeg (video assembly worker only)
[OUTPUT]: the step-by-step contract for producing each channel's real deliverable: one
  `codex exec` image call for `ugc-still`/`still`/`surface` channels, or real
  image-to-video generation plus ffmpeg assembly for `video` channels, ending in
  `assetPath` (png or assembled mp4), `coverPath` (video channels only, no-text cover
  frame), and `videoDurationSec` (video channels only) on that channel's
  `RolloutChannelPlan`
[POS]: shared reference both SKILL.md's and CODEX.md's station 8b link out to instead of
  repeating this block twice; SKILL.md/CODEX.md keep only the deliverable contract (the 3
  numbered rules, rule 1 being: a video channel means a real rendered video, never a
  `zoompan` pan-and-zoom fake-motion trick on a static image), the prompt contract, and a
  one-line pointer here
[PROTOCOL]: update this header on change, then check CLAUDE.md and skill/SKILL.md /
  skill/CODEX.md's station 8b sections
-->

# Produce the channel cut, step by step

Applies once a station 8b `RolloutDraft` has validated. Every channel gets its real
deliverable here, following `nativeFormat`.

## Image channels (`ugc-still`, `still`, `surface`)

One real image generation call, the same posture station 5 takes for the concept-level
still. Apply the same brand-pack and reference rules station 5 sets: fold `design.md`'s
matching prompt fragment into the adapted image prompt, splice in `references/meta.md`'s
UGC syntax for a `ugc-still` channel. If `codex` is installed and authenticated:

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

Once `assetPath` is set, fill that channel's `postKit.file` with the produced image path.

## Video channels, real video step by step

Applies whenever station 8b produces a channel cut whose `nativeFormat` is `video` (for
example `tiktok`). Two real steps, never a single fake-motion shortcut: ffmpeg assembles
only, it never originates motion.

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

Once both steps resolve (or resolve to null with a noted gap), fill that channel's
`postKit.file` with the assembled mp4's path once it exists, or the planned filename while
`assetPath` is still `null`.
