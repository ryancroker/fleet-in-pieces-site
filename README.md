# Fleet in Pieces

Game and development-community website for **https://fleetinpieces.space**. Public pages use HTML, CSS and vanilla JavaScript. Cloudflare Pages Functions provide the D1-backed community and optional Fleet Register. There is no frontend framework, external font service, analytics or commerce implementation.

**Community expansion — source ready; publication pending root verification.** The existing custom domain and Pages project are established. This handoff does not claim that the new homepage, migrations or passkey flows have been deployed or accepted on Ryan's phone. Historical deployment receipts describe earlier releases only.

## Pages and participation

| Route | Purpose |
| --- | --- |
| `/` | Real homepage: game introduction, bounded trending ideas and recently implemented ideas |
| `/game` | Preserved game overview, approved branding/gameplay, dev diary and Steam status |
| `/systems` | Available game-system briefings; missiles are the only seeded content object |
| `/systems/missiles` | Current missile behavior, authentic development clip, idea composer and discussion |
| `/community` | Bounded cross-content discovery, without an infinite generic social feed |
| `/fleet` | Fleet Register introduction and callsign lookup |
| `/register` | Optional passkey registration, sign-in, recovery and account security |
| `/u/{uuid}` | Public profile, contribution totals, allegiance and empty vessel assignment |
| `/i/{id}` | Permanent idea detail and reply thread; existing links and IDs remain valid |
| `/crew` | Private developer moderation desk |

The homepage no longer redirects to missiles. Explicit `/index` and `/index.html` aliases return to `/`. Primary navigation is Game, Fleet, Systems, Community and Register.

Browsing, voting, submitting ideas and replying never require registration. The idea form keeps its 8–2,000 character body and optional handle; it adds no title, tags, email or category requirement. Guest handles and drafts are remembered locally. Public ideas, replies and votes live in D1, never simulated browser storage. Authored game information and media remain readable without JavaScript; live discussions, discovery and register actions need JavaScript.

## Authoring and release assets

Use **Node 22** for authoring. Install locked dependencies and prepare the committed server bundle after a dependency change:

```powershell
npm ci
node scripts/prepare-auth.mjs
node scripts/prepare-site.mjs
```

`@simplewebauthn/server` is pinned to **14.0.3** in `package.json` and the lockfile. It is a server-only WebAuthn verification dependency; browser code uses native WebAuthn. The authoring script itself uses only Node built-ins. With the required blank build command, Pages skips npm installation. `prepare-auth.mjs` uses pinned esbuild 0.28.2 to package the four verification/option exports and dependency license notices into `functions/_lib/vendor/`. Commit this server-only output whenever the dependency lock changes. Pages bundles the committed module without installing npm packages; the deployed frontend has no framework or build command.

Edit `content/systems.json` and `templates/system.html` for system briefings. `prepare-site.mjs` writes the generated page, currently `site/systems/missiles.html`, and applies the shared navigation. New real content also needs an additive registry migration using the same stable content ID. Do not edit generated briefing HTML as the lasting source of a content change.

Run the script after changing authored content, HTML, CSS or browser JavaScript. It normalizes release bytes to UTF-8/LF, creates content-fingerprinted CSS/JS files and updates HTML references together. Keep stable source filenames editable, never change an existing fingerprinted file, and retain old release copies for cached HTML. This replaces the old manual community-CSS fingerprint procedure. Review and commit the generated output with its source; Cloudflare publishes the prepared `site/` directory.

A returning-browser cache failure previously combined new HTML with old community CSS. Source `_headers` requested revalidation, but the live custom domain returned a four-hour browser lifetime. Fingerprinted filenames address that mismatch without DNS or account-level cache changes. Verify the actual release asset URL and a returning-browser reload after layout changes.

## Local preview

For static layout only:

```powershell
python preview.py
```

Open **http://127.0.0.1:4173/**. The helper reproduces static paths, the custom 404 and security headers, but it does not run Functions, D1 or passkeys.

For community and identity behavior, use the installed Wrangler CLI:

```powershell
npx wrangler d1 migrations apply COMMUNITY_DB --local
npx wrangler pages dev site --ip 127.0.0.1 --port 4174 --d1 COMMUNITY_DB=a27dbf92-3ecb-4b41-9428-2d76ba7a558e
```

Open **http://localhost:4174/** for passkeys; `localhost` is the supported development RP, rather than the numeric loopback URL. The explicit local D1 override is needed because Pages dev uses preview settings. It still uses isolated local storage in ignored `.wrangler/state`. Stop either preview with Ctrl+C.

Create ignored `.dev.vars` with separate local `COMMUNITY_ADMIN_KEY` and `COMMUNITY_SIGNING_KEY` values. Never use production credentials in local fixtures. Exercise posting, identity and allegiance against local D1; do not create public review posts or identities.

## Community data and developer responses

`content_objects.id` permanently owns a discussion. The existing missile object is `system-missiles`, with slug `missiles` and path `/systems/missiles`. Migration 0002 adds the registry, backfills existing ideas and retains the legacy `system` column for old clients. It does not rebuild idea, reply or vote tables. `contribution_types` is a foundation for later submissions; only ordinary ideas are enabled now.

System feeds default to Top, with New, Dev responded and Implemented filters. `/api/discovery` returns at most six trending and four implemented ideas. Trending uses real recent activity within a bounded candidate set; empty data stays empty. `/api/content` exposes the real published content registry. There is no fabricated ship catalog, popularity or feedback history.

The developer desk offers nine deliberate Fleet Command presets: SUBMITTED, POPULAR, LOOKING AT THIS, PROTOTYPING, PLANNED, IMPLEMENTED, NO, THIS WOULD BREAK EVERYTHING, and TECHNICALLY POSSIBLE, UNFORTUNATELY. They map to the existing normalized states. Custom labels and previous decisions remain intact. POPULAR is an editorial choice, not an automatic vote threshold. Only ideas actually marked implemented enter implementation records.

Open **https://fleetinpieces.space/crew** with the key from ignored `.community-admin-key.txt`. The page holds the key in memory; Lock or reload clears it, and the API checks it on every privileged request. Reports support inspection, hide/restore and resolution. Hidden ideas and their replies disappear from public views. Moderation preserves original text and author credit, with status/response history in D1.

Keep `COMMUNITY_SIGNING_KEY` stable: rotating it invalidates anonymous browser identities and can prevent guests from removing old votes. Never place admin keys, session cookies or recovery codes in public posts, URLs, screenshots, logs or commits.

## Optional Fleet Register

Registration uses a public callsign and device passkey, without email or passwords. Guest participation remains available. Registered profiles have opaque UUIDs and start as **Recruit**. Rank definitions are data-driven; rank and promotion eligibility are distinct, with no automatic promotion rule or fabricated vessel assignment.

A high-entropy recovery code is shown once; only its hash is stored. Recovery enrolls a new passkey, replaces the old keys, revokes old sessions and rotates the recovery code. Members can add another passkey or replace their recovery code after recent sign-in. Losing all passkeys and the recovery code may mean losing access. Production passkeys use the canonical game domain; temporary Pages hosts direct visitors there.

Claiming existing browser activity is explicit. Original idea/reply IDs and raw vote actors are retained; claimed aliases count as one registered voter's support. An account is not proof of a real-world identity. Profiles expose public callsigns, join date, rank, contribution totals and command relationships, not credential material or customer information.

Swear Allegiance assigns one superior and moves the entire subordinate branch. Leaving takes that branch along. Atomic database guards prevent cycles; the current limits are 12 command levels and 2,000 members per connected command tree. Advanced politics, vessel outfitting and browser combat are not implemented.

See **[COMMUNITY_ARCHITECTURE.md](COMMUNITY_ARCHITECTURE.md)** for the data model and future commerce separation. No shop, checkout provider, order table, webhook or purchase badge is built. Future commerce must allow guest checkout, leave payment/shipping/customer data with its provider, and keep any optional profile association separate from community authentication.

## Hosting and publication

Reuse the existing Git-integrated Cloudflare Pages project and repository; do not create another project, force-push, change DNS or alter paid plans for this work.

| Setting | Value |
| --- | --- |
| Repository | `ryancroker/fleet-in-pieces-site` |
| Pages project | `fleet-in-pieces-site` |
| Production branch | `main` |
| Framework preset | `None` |
| Build command | Leave blank; prepared frontend assets are committed |
| Build output | `site` |
| Root directory | Repository root / blank |
| Tooling Node version | `22` |
| D1 binding | `COMMUNITY_DB` → `fleet-in-pieces-community` |
| Encrypted secrets | `COMMUNITY_ADMIN_KEY`, `COMMUNITY_SIGNING_KEY` |

`wrangler.toml` pins compatibility to May 22, 2026 and defines production D1. Preview deliberately has no production D1 binding. `_routes.json` invokes Functions for `/api/*`, `/i/*` and `/u/*`; the other pages and media are static. Only `site/` is public static output. `node_modules`, local secrets, database exports and QA profiles must stay outside it.

Before the first expansion deployment, export the live database to a private path outside `site/`, record existing IDs/counts, apply reviewed additive migrations **0002 and 0003**, and verify the historical records remain intact. Both migrations must precede Functions that read the new columns. Then publish the reviewed source through the existing GitHub `main` integration. Do not drop tables or replace D1 as a frontend rollback.

Publication remains pending root verification. Confirm the Git-backed deployment, actual apex/www pages, fingerprinted assets, API and preserved `/i/{id}` links. Ryan owns real-device passkey prompts and phone acceptance; a successful bundle or virtual credential does not prove device sync or biometric UX. Earlier browser receipts in `QUALITY_REVIEW.md` and `../../Saved/SourceChanges/FleetWebsiteDeployment_20261002` cover earlier releases only.

## Branding, links and media

Keep the approved transparent wordmark `site/assets/logo/fleet-in-pieces-transparent.webp` (1348×240). Preserve the restrained dark graphite/naval presentation, dim logo and honest development status. Review meaningful layout changes at about 390px and desktop widths in a real browser; avoid elaborate internal test harnesses.

External destinations are configured in `site/config.js`. Keep `SITE_URL` as `https://fleetinpieces.space`; canonical metadata is authored separately. Blank Steam, YouTube and contact values must remain honest unavailable states. Add only real destinations. Update static TikTok fallbacks in authored pages/templates when changing its handle. Steam CTAs become active when a real Steam URL is supplied.

**[ASSET_CHECKLIST.md](ASSET_CHECKLIST.md)** lists media inputs; **[MEDIA_SOURCES.md](MEDIA_SOURCES.md)** records provenance. Use authentic silent gameplay, native aspect ratios and the approved logo. The missile clip is archived development footage, not proof of the current game build. No new game/editor launch, filming, watermarked social download, third-party music or invented gameplay is authorized by website work. Keep full source recordings and game files outside `site/`.

The `/game` hero may autoplay only under its existing desktop/motion/data rules; phones and feature clips wait for explicit play. Preserve accessible native controls as the fallback. There is no service worker or offline application.

## Abuse and privacy boundaries

Preserve plain-text rendering, same-origin JSON mutations, signed browser identity, request idempotency, server-side rate limits, parameterized SQL and report/hide tools. The application stores daily salted IP hashes for limits, not raw IP addresses. Cookie clearing is not identity verification, and shared-network limits can affect several visitors.

Profanity is allowed. Pattern checks and the hidden spam field catch some obvious links/private information, but contextual abuse still needs human moderation. Failed requests show honest retry states and preserve drafts. Votes represent enthusiasm, not command authority.
