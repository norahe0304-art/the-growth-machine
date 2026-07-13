# Brand Memory

This is an independent portfolio analysis, not affiliated with or endorsed by any brand
named below; the pack is a demonstration of the machine's architecture, swappable for
any brand.

A pluggable brand pack. `brand/openai/` holds four files: `brand.md` (voice and
stance), `design.md` (visual grammar), `channels.md` (channel precedent), and
`history.md` (the nine-fire track record and the four laws). Every claim cites a
case, drawn from The Growth Book research (`CASES.md`, 45 cases) and the
30x-covers skill's OpenAI visual language.

The pack is swappable: a different brand gets its own `brand/<name>/` directory
carrying the same four files, and `src/` should never hardcode `openai` as a path.

Intended consumption by station, once wired: **insight** reads `brand.md` and
`history.md` for proven asset-x-new-element patterns and voice. **produce** reads
`design.md` for the visual register and prompt fragments. **judge** adds a
brand-fit gate sourced from `brand.md`'s three on-brand checks. **rollout** reads
`channels.md` to pick the channel a SCALE verdict ships to.

This lane only distills the memory. Station wiring (`src/stages/*.ts` reading
these files) is left to a later lane.
