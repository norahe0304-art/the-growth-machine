# Meta / Instagram

## Live and corpus sources, three tiers

### Tier 1, your own corpus (primary ammo, bring your own)

Bring your own reference library. The machine looks for an optional local corpus at
`references/meta.local.md` first; when present, its scored entries and house rules
take priority over everything below. When absent, the machine falls back to the
starter rules in this file.

How to consume it. Pull house rules directly when writing a produce-station brief for
a Meta or IG asset. Pull individual scored entries when the moment needs a close
analog, matching on category and format over brand.

### Tier 2, meta-ads-scraper (optional tool, ToS flagged)

Repo: github.com/athm793/meta-ads-scraper

23 stars, actively maintained as of 2026-06. Runs local Playwright against the Meta Ad
Library, no login stored server-side. Ships a Hook Lab that grades ads into three tiers:
Battle-tested (running 30 days or more), Gaining (rising spend), and New test (recently
launched, unproven).

ToS flag. This tool automates access to a public page in a way that sits outside Meta's
own automation terms. It is optional and self-assumed risk, see `references/README.md`
for the full honesty statement. Do not default to it, reach for it only when tier 1 and
tier 3 do not cover the moment.

### Tier 3, Meta Ad Library official web (fallback)

URL: https://www.facebook.com/ads/library

No login required for basic search. Use as the fallback when tier 1 has no close analog
and tier 2 is not available or not warranted. Search by keyword and by advertiser, filter
to active ads, treat run length as the same battle-tested signal tier 2 automates.

## Starter rules

Starter rules: generic UGC ad craft, usable as-is; supply your own corpus for sharper,
brand-specific rules.

The core UGC syntax below starts from the Battle-tested (30 day plus) concept tier
defined above. An ad that survives 30 days of live spend without being pulled has cleared
the market's own filter already. The Growth Book's Brief Anatomy chapter names this same
30-day discipline as a house rule for judging a concept a keeper rather than a fresh
guess. One is Meta's spend signal read off the ad library, the other is a writing rule
from the book this repo runs, and both treat sustained time-in-market as the evidence
bar a concept has to clear.

1. Cold open on the product already in use, in the hand or on the face, before any
   branding.
2. Write the hook as a spoken sentence a real customer would say, in the voice of a
   testimonial rather than ad copy. First person, plain words.
3. Show the before state honestly, do not exaggerate the problem past what is credible.
4. Cut to the specific mechanism or moment that caused the change, one clear beat held
   long enough to register, rather than a fast montage.
5. Keep the CTA verbal and casual, delivered in the same voice as the rest of the video
   instead of a separate polished tag-on.
6. Static image ads should mimic a screenshot or a text-message aesthetic over a
   studio-lit product shot when the goal is feed-native trust.
7. Caption text should read as a comment or a testimonial fragment, staying below the
   register of a headline.
