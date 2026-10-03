# Fleet in Pieces website

## Current handoff — community expansion, October 3, 2026

Source is ready for the expanded game/community site; **publication is pending root verification**. Do not present this handoff as a successful production deployment or Ryan's real-device acceptance. Existing domain/Pages setup is established, but older release receipts do not validate this expansion.

Read README.md and COMMUNITY_ARCHITECTURE.md before detailed work. This repository is separate from the older private Sites prototype in `../FleetInPieces`; do not publish it through Sites or copy that project's `.openai` identity.

## Hosting and source boundaries

Keep the existing Cloudflare Pages project `fleet-in-pieces-site`, GitHub repository `ryancroker/fleet-in-pieces-site`, production branch `main`, framework None, blank build command and output `site`. Apex `fleetinpieces.space` and `www.fleetinpieces.space` already have domain associations. Do not repeat DNS setup, create a replacement project, force-push, change paid plans or alter account settings for routine site work.

Pages Functions run on the Workers runtime, with production D1 `COMMUNITY_DB`. Routes are `/api/*`, `/i/*` and `/u/*`; other pages/media are static. `wrangler.toml` intentionally gives previews no production database. Use local D1 for review. Only `site/` is public static output; server code, game source, local database state, secrets and QA profiles stay outside it.

Use **Node 22** and `npm ci` for locked server dependencies. `@simplewebauthn/server` is explicitly authorized and pinned to **14.0.3**; it verifies passkeys server-side. Browser authentication uses native WebAuthn. Keep HTML/CSS/vanilla JS: no frontend framework, font CDN, analytics or unrelated dependencies without Ryan's instruction. A local authoring step is now part of this repo even though the Pages build command remains blank.

## Authoring and release caching

Run `node scripts/prepare-site.mjs` after changes to authored content, HTML, CSS or browser JS. It generates system briefings from `content/systems.json` and `templates/system.html`, applies shared navigation, writes UTF-8/LF content-fingerprinted CSS/JS release files and updates HTML references. Review generated output alongside the source. Edit the content/template for lasting missile-page changes, rather than only the generated `site/systems/missiles.html`.

The script replaces the former manual three-page community-CSS fingerprint process. Keep stable source filenames editable and retain previous hashed assets for cached HTML; never rewrite an existing fingerprinted asset. Ryan's desktop regression was reproduced by new HTML plus old community CSS, and the custom domain returned a longer cache lifetime than source headers requested. Check the loaded fingerprinted URL and a returning-browser reload, not only a fresh browser. No account-level cache change is needed for this release convention.

## Pages and community behavior

`/` is a real branded game/community homepage with bounded trending and recently implemented sections; it no longer redirects to missiles. `/game` preserves the full marketing overview and authentic media. `/systems` lists available briefings, `/community` provides bounded discovery, `/fleet` introduces the register and callsign lookup, and `/register` manages optional identity. Primary navigation is Game / Fleet / Systems / Community / Register.

`/systems/missiles` is the first reusable content briefing: CURRENT, prominent authentic footage, contribution form, discussion and real implemented-from-feedback history. Only the actual missile content object is seeded. Do not invent ship catalogs, activity, vote counts, implementations or release promises. The clip is archived authentic development footage, not proof of today's game build.

Keep browsing, voting, ideas and replies available without an account. Idea submission remains an 8–2,000 character body with optional handle and no title/category/tag/email requirement. Use real D1 persistence, never fake localStorage community data. Top is the default; New, Dev responded and Implemented are additional filters. Reports open on demand rather than occupying every card. `/i/{id}` remains the permanent full idea/thread URL.

Stable `content_objects.id` owns the discussion; `system-missiles` must not change when a title/slug changes. Migration 0002 is additive and retains legacy system values, existing ideas/replies/votes and their IDs. Only the ordinary idea contribution type is enabled. Add new real content through both the authored template data and an additive registry migration, with matching stable IDs and redirects for renamed paths.

Fleet Command's nine personality presets map to existing normalized states. Preserve custom labels and historical decisions; POPULAR is explicitly assigned, never fabricated from a guessed threshold. Discovery returns at most six trending and four implemented ideas; empty data has honest empty states. Votes represent enthusiasm, not command authority.

## Optional identity and allegiance

Migration 0003 adds passkey identities, opaque UUID profiles, explicit browser-activity claims and allegiance. Registration uses a callsign, not email/passwords. Anonymous signed-browser cookies remain independent from login cookies. A profile starts as Recruit; rank configuration and promotion eligibility are separate, with no automatic promotion threshold. Vessel assignment remains empty; no browser combat or fitting system is built.

Keep challenge consumption, exact origin/RP checks, user verification, counter checks, session-version guards and secure HttpOnly cookies. Recovery codes are high entropy and shown once; only hashes are stored. Recovery requires a new passkey, replaces old keys/sessions and rotates the code. Do not log or expose recovery codes, session tokens, private keys or credential material in public profiles. Local passkey review must use `localhost`; production uses the canonical game domain, not temporary Pages hosts.

Claims are explicit and limited to activity owned by the same signed browser token. Preserve raw historical actors and vote rows; count linked aliases as one profile's vote. Public author links use `/u/{uuid}`. Callsigns are public labels, not verified real-world identities.

Swear Allegiance moves the whole subordinate branch, and leaving retains that branch. Preserve atomic closure-table guards against cycles and the current bounds of 12 levels/2,000 members per connected command tree. More advanced politics, commissions and automatic promotions remain future work.

See **[COMMUNITY_ARCHITECTURE.md](COMMUNITY_ARCHITECTURE.md)** for commerce separation. There is **no store in this pass**. Future checkout must allow guests and keep payment, tax, customer email, shipping and fulfillment with a provider. An optional server-controlled opaque profile association must not turn community authentication into a customer-data system. No provider, order table, webhook or purchase badge is active.

## Moderation, release and acceptance

Protect `/api/admin` on the server, not by hiding `/crew`. Secrets COMMUNITY_ADMIN_KEY and COMMUNITY_SIGNING_KEY belong in encrypted Cloudflare settings; `.dev.vars` and `.community-admin-key.txt` stay ignored. Keep the signing secret stable across releases. Public text stays plain text, profanity is allowed, and reports/human moderation handle contextual abuse. Preserve origin checks, request idempotency, rate limits, parameterized SQL and hide/restore behavior.

Before production migration, export D1 privately outside `site/`, record existing IDs/counts, apply reviewed additive migrations 0002 and 0003, and verify preservation before deploying the new Functions. Do not rebuild/drop production tables or replace D1 for a frontend rollback. No public test posts or identities: review against isolated local D1.

Ryan requested small real-browser website checks around 390px and desktop widths; do not replace them with elaborate internal harnesses. Successful syntax/bundle checks do not establish live behavior. Ryan owns real-phone/passkey acceptance; virtual credentials do not prove platform sync or biometric prompts. Record actual publication evidence only after the root verification succeeds.

## Branding and authentic media

Keep the dark graphite/naval style, readable typography, restrained dividers and dim approved logo. Use `site/assets/logo/fleet-in-pieces-transparent.webp` (1348×240, RGBA, 33738 bytes), never the opaque original. Preserve `/game`'s approved centered desktop masthead, compact phone/tablet logo, graphite/navy gradient and pale-blue CTA. Existing hero evidence is in `../../Saved/SourceChanges/FleetWebsiteHero_20261002`; it is historical evidence, not new-release acceptance.

External destinations are configured in `site/config.js`; authored pages/templates also contain deliberate static TikTok fallbacks. Blank Steam URL stays an honest coming-soon state. Do not invent app IDs, contact addresses, dates or feature promises. Unknown socials stay unavailable.

Read ASSET_CHECKLIST.md and MEDIA_SOURCES.md before changing clips. Use authentic silent gameplay and preserve native aspect ratios. Website work does not authorize new game/editor launch, filming, game-source changes or packaging full recordings. Keep gameplay-frame acceptance separate from browser-layout review.
