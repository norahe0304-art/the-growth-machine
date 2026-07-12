# References

This layer holds channel winners libraries, feeding the produce station (station 5,
`skill/SKILL.md`) with real creative patterns instead of invented ones.

## Two-tier ammo design

Live sources: TikTok Creative Center and the Meta Ad Library, pulled fresh, weekly, per
channel. The channel files below carry the URL, the filter recipe, and the signal to
read for each one.

Distilled corpus: a starter rules section per channel file, distilled once from
editorial sources or from Nora's own prior corpus. Treat these as a cold-start default
only. A fresh live pull always outranks them.

## Consumption convention

Before writing copy or prompts in the produce station, open the channel file for the
target platform. Pull fresh live winners when a live pull is possible. Starter rules are
the fallback, each one carrying a status tag for whether it has been checked yet against
a live pull.

## ToS honesty

Official libraries come first. TikTok Creative Center and the Meta Ad Library web UI are
both free, official, and need no login for the data used here.

`meta-ads-scraper` (github.com/athm793/meta-ads-scraper) automates access to public Meta
Ad Library pages, a kind of automation that sits outside Meta's own terms. Using it is a
self-assumed risk. Default machine behavior stays inside Nora's own corpus and the
official web UIs; the scraper stays an optional, deliberately flagged tool.

Wiring this library into the skill's contract is a separate lane's job.
