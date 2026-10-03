# Fleet in Pieces website

The production target is Cloudflare Pages with GitHub integration. `site/` is the complete public output. Keep HTML/CSS/minimal vanilla JS and no front-end build step. Ryan explicitly authorized the October 3 community backend: Pages Functions (Workers runtime) with D1, scoped to `/api/*` and `/i/*`. Marketing and system content remain static. Do not introduce framework/npm/font-CDN/analytics dependencies without a new user instruction.

Read README.md for publication state and exact settings. This repo is separate from the older private Sites prototype in `../FleetInPieces`; do not publish this project through Sites or copy its `.openai` identity into this repository.

**CUSTOM DOMAIN LIVE - October 2, 2026.** https://fleetinpieces.space/ and https://www.fleetinpieces.space/ are active on the existing Cloudflare Pages project `fleet-in-pieces-site`, fed by https://github.com/ryancroker/fleet-in-pieces-site `main`. Keep framework None, blank build, output `site`. Ryan completed domain setup himself. Do not repeat the old DNS setup instructions, change hosting infrastructure, or alter account settings for visual edits.

Ryan approved the second transparent logo edit and requested a larger centered desktop masthead. Use `site/assets/logo/fleet-in-pieces-transparent.webp` (1348x240, RGBA, 33738 bytes); do not revert to the opaque original. Above 1150px it is centered at up to820px above the two hero columns; phone/tablet use the compact inline version. Both references share the same asset. Hero gradient is #05080c through #081018, with a restrained64px red divider. Keep the pale-blue CTA and dim logo filter. Hero source and390/1440px browser evidence live in `../../Saved/SourceChanges/FleetWebsiteHero_20261002`. No DNS/hosting changes are authorized by this visual pass.

Keep the dark, restrained style and dim laser-line logo. Phone visitors matter: check the actual page at about390px after meaningful layout changes. Ryan requested browser visual checks for this site; do a small real-browser pass, not an elaborate internal test suite. Keep gameplay-frame judgments separate from website layout review.

All external destinations are in `site/config.js`. Blank Steam URL must remain an honest coming-soon state; do not invent a Steam app ID, email, release date or feature promise. The static TikTok link is the documented no-JS fallback. Unknown socials stay hidden.

See ASSET_CHECKLIST.md and MEDIA_SOURCES.md before replacing clips. Use authentic silent gameplay and preserve native aspect ratios. No new game/editor launch or filming is authorized by this website task. Do not package the game source, saved credentials, QA browser profile or full source recordings with the site.

## Missile community — October 3, 2026

Ryan requested Phase 1 at `/systems/missiles`: no accounts for suggestions, votes or replies, optional locally remembered handle, Top/New sorting, reports and private developer responses/status. Use real D1 persistence, never simulated localStorage community data or seeded fake activity. Pages Functions are the requested small Worker layer within the existing Pages project. New D1 database `fleet-in-pieces-community` is authorized; no DNS, plan or unrelated account changes.

`wrangler.toml` binds COMMUNITY_DB in production and intentionally leaves preview without a D1 binding. Local Wrangler uses a separate local database. `functions/` contains server handlers; `migrations/` contains schema changes. Only `site/` is public static output. Secrets COMMUNITY_ADMIN_KEY and COMMUNITY_SIGNING_KEY belong in encrypted Cloudflare settings. `.dev.vars` and `.community-admin-key.txt` are local ignored secrets, never public assets or commits. Protect `/api/admin` on the server, not merely by hiding `/crew`.

Public text is plain text, names are unverified, profanity is allowed. Preserve server-side limits, request idempotency, signed browser identity, parameterized SQL, origin checks and report/hide tools. Votes indicate enthusiasm, not development obligations. Do not imply semantic moderation is foolproof or anonymous votes identify unique people. Do not create public test posts; use local D1 for interaction checks. Ryan performs acceptance on his phone.

Only missiles are live in Phase 1. No invented ship catalog, trending counts, release promises or implemented-from-feedback history. Missile CURRENT copy is grounded in current source; the included 12-second range clip is archived authentic development footage, not proof of today's game build. See MEDIA_SOURCES.md.

Community Phase1 is live at https://fleetinpieces.space/systems/missiles. GitHub main commit24ccaf440bc0611730350667aadcc1afcfdeef7c deployed successfully as CloudflarePages94733054-1523-48b9-978a-0eeef5f9c69c. ProductionD1 binding and encrypted secret names were verified;390/1440 custom-domain and Pages browser checks passed. Both apex/www use HTTPS and canonical missile URLs; the production crew key unlocked the empty inbox. Seven changed assets match committed Git hashes. Production contains no review posts. Live checks kept the board empty; local QA fixtures are isolated. User acceptance on a real phone remains Ryan's.
