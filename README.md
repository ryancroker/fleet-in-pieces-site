# Fleet in Pieces

Game and development-community website for **https://fleetinpieces.space**. Public pages use HTML, CSS and vanilla JavaScript. Cloudflare Pages Functions provide the D1-backed community and optional Fleet Register. There is no frontend framework or external font service. Cloudflare supplies the existing analytics beacon; Fourthwall handles external merchandise checkout.

**Prior community expansion release — October 3, 2026.** Published through GitHub main commit `3293639b39af460f181135fb735f694af08873dd`, Cloudflare deployment `1a0b0abb-3c18-4284-899b-1c9dc6dc62c4` (October 3, 2026). Apex and www HTTPS, Register API/RP, Pages noindex/canonical-host auth guard, original /i/1, canonical/OG resources, release asset hashes and 390/1440px layouts verified in Chrome. All original 10 ideas, 2 replies, 10 votes and 10 history rows compared unchanged after migrations 0002/0003. Local anonymous posting/reply/vote/report, developer implementation filter/discovery, native WebAuthn with virtual credentials (signup/signin/add key/recovery/claim), profile and whole-branch move/leave/cycle checks passed. No public QA identities/posts. Ryan owns real-phone/Windows Hello prompts and passkey sync acceptance. Evidence: `../../Saved/SourceChanges/FleetCommunityExpansion_20261003`.

## Current visitor flow

The homepage introduces the game and footage first, then feature briefings, real community ideas, recent development, a secondary merchandise notice and optional identity. Native navigation is **Game / Systems / Ships / Community / Dev Log / Quartermaster**. Fleet Register and allegiance are discovered through community content and footer links; guest participation never requires joining.

| Route | Purpose |
| --- | --- |
| `/` | Game-first homepage with footage, briefings, bounded discussion, development and merch |
| `/game` | Preserved full game overview, approved masthead, authentic clips and Steam status |
| `/systems`, `/ships` | Small directories of actual available briefings |
| `/systems/missiles`, `/systems/damage`, `/systems/siege` | Current behavior, footage, discussion and real implementation record |
| `/ships/carriers`, `/ships/rescue` | Authentic ship-role briefings with the same guest participation flow |
| `/community` | Bounded trending and implemented ideas; optional Fleet Register introduction |
| `/dev-log` | Authored development updates plus actual implemented-from-feedback records |
| `/quartermaster` | Native shirt presentation; one direct Fourthwall product purchase CTA |
| `/fleet`, `/register` | Callsign lookup and optional passkey identity/recovery |
| `/u/{uuid}` | Public contribution history, rank, actual allegiance tree and empty vessel assignment |
| `/i/{id}` | Permanent idea and reply thread; existing shared URLs remain valid |
| `/crew` | Private developer moderation desk |

Browsing, voting, submitting ideas and replying never require registration. The idea form keeps its 8–2,000 character body and optional handle; it adds no title, tags, email or category requirement. Guest handles and drafts are remembered locally. Public ideas, replies and votes live in D1, never simulated browser storage. Authored game information and media remain readable without JavaScript; live discussions, discovery and register actions need JavaScript.

## Authoring and release assets

Use **Node 22** for authoring. Install locked dependencies and prepare the committed server bundle after a dependency change:

```powershell
npm ci
node scripts/prepare-auth.mjs
node scripts/prepare-site.mjs
```

`@simplewebauthn/server` is pinned to **14.0.3** in `package.json` and the lockfile. It is a server-only WebAuthn verification dependency; browser code uses native WebAuthn. The authoring script itself uses only Node built-ins. With the required blank build command, Pages skips npm installation. `prepare-auth.mjs` uses pinned esbuild 0.28.2 to package the four verification/option exports and dependency license notices into `functions/_lib/vendor/`. Commit this server-only output whenever the dependency lock changes. Pages bundles the committed module without installing npm packages; the deployed frontend has no framework or build command.

Edit `content/systems.json` and `templates/system.html` for system/ship briefings. Entry pages come from `scripts/render-pages.mjs`, development updates from `content/development.json`, and merchandise metadata from `content/merch.json`. `prepare-site.mjs` generates these pages, shared navigation and sitemap. New real content also needs an additive registry migration using the same stable content ID. Do not edit generated briefing HTML as the lasting source of a content change.

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

System feeds default to Top, with New, Dev responded and Implemented filters. Eight ideas load at a time, with More ideas for the rest. Replies open inline; the full `/i/{id}` thread remains available. `/api/discovery` returns at most six trending and four implemented ideas. Trending uses real recent activity within a bounded candidate set; empty data stays empty. `/api/content` exposes the real published content registry. The five published briefings use existing footage; there is no invented specification catalog, popularity or feedback history. The original legacy `ideas.system` constraint remains intentionally unchanged; `content_id` owns every discussion.

Open **https://fleetinpieces.space/crew** with the key from ignored `.community-admin-key.txt`. Unlock once to use the inbox and **Manage suggestion / Manage reply** beside public discussions. Access lasts up to eight hours in that browser; **Lock** revokes it. The key is cleared from the input and exchanged for a server-verified HttpOnly, Secure, SameSite=Strict cookie; it is not saved in browser storage. Every privileged request is checked on the server. Ordinary Fleet accounts do not grant creator access.

For something that already exists: choose **Already in Game**, write a short explanation, and **Save decision**. For an actual community-driven change: choose **Implemented from Feedback** and describe the change. **Both require a note.** Only the latter appears in implementation-from-feedback lists and profile totals. Historical implemented badges stay intact but need explicit classification before receiving this credit.

The inbox starts with Needs response and includes New, Popular, Under review, Planned / prototyping, From feedback, Already in game, Reported, Unclassified implemented and All. Status and note stay immediately visible in the editor; advanced controls expand on demand:

- Pin, move to another published briefing, hide/restore or lock new replies.
- Attach a build, date and up to three game-page, dev-log, screenshot or clip links.
- Link a Duplicate or Superseded idea by its `/i/{number}`. Optional permanent duplicate consolidation combines discussion/votes while retaining original URLs, text and authors; shared voters count once.
- Clarify a title or formatting with a public explanation and expandable original. The original text is never overwritten.
- Promote a reply into an attributed, linked suggestion, retaining the original reply.

Reports support inspection, hide/restore and resolution. Revision checks prevent overwriting a newer edit. Migration0005 adds metadata, creator sessions and audit records without reclassifying or replacing production content.

Keep `COMMUNITY_SIGNING_KEY` stable: rotating it invalidates anonymous browser identities and can prevent guests from removing old votes. Never place admin keys, session cookies or recovery codes in public posts, URLs, screenshots, logs or commits.

## Optional Fleet Register

Registration uses a public callsign and device passkey, without email or passwords. Guest participation remains available. Registered profiles have opaque UUIDs and start as **Recruit**. Rank definitions are data-driven; rank and promotion eligibility are distinct, with no automatic promotion rule or fabricated vessel assignment.

A high-entropy recovery code is shown once; only its hash is stored. Recovery enrolls a new passkey, replaces the old keys, revokes old sessions and rotates the recovery code. Members can add another passkey or replace their recovery code after recent sign-in. Losing all passkeys and the recovery code may mean losing access. Production passkeys use the canonical game domain; temporary Pages hosts direct visitors there.

Claiming existing browser activity is explicit. Original idea/reply IDs and raw vote actors are retained; claimed aliases count as one registered voter's support. An account is not proof of a real-world identity. Profiles expose public callsigns, join date, rank, contribution totals and command relationships, not credential material or customer information.

Swear Allegiance assigns one superior and moves the entire subordinate branch. Leaving takes that branch along. Atomic database guards prevent cycles; the current limits are 12 command levels and 2,000 members per connected command tree. Advanced politics, vessel outfitting and browser combat are not implemented.

See **[COMMUNITY_ARCHITECTURE.md](COMMUNITY_ARCHITECTURE.md)** for the data model and future commerce separation. The native Quartermaster page directs purchase to Fourthwall; no native cart, order table, webhook or purchase badge is built. Future commerce must allow guest checkout, leave payment/shipping/customer data with its provider, and keep any optional profile association separate from community authentication.

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

Before each database migration, export the live database privately outside `site/`, record existing IDs/counts, apply only reviewed pending migrations, and verify historical records. This pass adds only **0004**, four content registry inserts; 0002/0003 are already live. Then publish the reviewed source through the existing GitHub `main` integration. Do not drop tables or replace D1 as a frontend rollback.

For future releases, confirm the Git-backed deployment, actual apex/www pages, fingerprinted assets, API and preserved `/i/{id}` links. Ryan owns real-device passkey prompts and phone acceptance; a successful bundle or virtual credential does not prove device sync or biometric UX. Earlier browser receipts in `QUALITY_REVIEW.md` and `../../Saved/SourceChanges/FleetWebsiteDeployment_20261002` cover earlier releases only.

## Branding, links and media

Keep the approved transparent wordmark `site/assets/logo/fleet-in-pieces-transparent.webp` (1348×240). Preserve the restrained dark graphite/naval presentation, dim logo and honest development status. Review meaningful layout changes at about 390px and desktop widths in a real browser; avoid elaborate internal test harnesses.

External destinations are configured in `site/config.js`. Keep `SITE_URL` as `https://fleetinpieces.space`; canonical metadata is authored separately. Blank Steam, YouTube and contact values must remain honest unavailable states. Add only real destinations. Update static TikTok fallbacks in authored pages/templates when changing its handle. Steam CTAs become active when a real Steam URL is supplied.

**[ASSET_CHECKLIST.md](ASSET_CHECKLIST.md)** lists media inputs; **[MEDIA_SOURCES.md](MEDIA_SOURCES.md)** records provenance. Use authentic silent gameplay, native aspect ratios and the approved logo. The missile clip is archived development footage, not proof of the current game build. No new game/editor launch, filming, watermarked social download, third-party music or invented gameplay is authorized by website work. Keep full source recordings and game files outside `site/`.

The homepage and `/game` heroes may autoplay only under its existing desktop/motion/data rules; phones and feature clips wait for explicit play. Preserve accessible native controls as the fallback. There is no service worker or offline application.

## Abuse and privacy boundaries

Preserve plain-text rendering, same-origin JSON mutations, signed browser identity, request idempotency, server-side rate limits, parameterized SQL and report/hide tools. The application stores daily salted IP hashes for limits, not raw IP addresses. Cookie clearing is not identity verification, and shared-network limits can affect several visitors.

Profanity is allowed. Pattern checks and the hidden spam field catch some obvious links/private information, but contextual abuse still needs human moderation. Failed requests show honest retry states and preserve drafts. Votes represent enthusiasm, not command authority.

## Native Quartermaster

Shared desktop/mobile navigation and grouped footers point to `/quartermaster`. The homepage merchandise notice follows game, community and development content and links to that native page. Only **Buy the first issue** opens the direct product URL:
`https://fleet-in-pieces-shop.fourthwall.com/products/first-it-was-a-ship-now-its-a-shirt`

The purchase link uses a new tab with `noopener noreferrer`; no Fleet identity is sent. No link routes through Fourthwall's generic store homepage. The actual product mockup and verified metadata are in `content/merch.json`; current starting price is US$21 (October 3, 2026), with variant pricing, shipping and tax settled on Fourthwall. Keep product data and the outbound purchase destination separate so a future Storefront API/cart adapter can replace this boundary without changing community authentication. That integration is not built in this pass.

Change the purchase destination in `site/config.js`, refresh verified metadata in `content/merch.json`, and run `node scripts/prepare-site.mjs`. Keep this as an extension of the game site, not an ecommerce homepage.

## Analytics and local review

The existing Cloudflare beacon was blocked by the original self-only script policy. Static and Functions CSP now permit its script and connection origins; there is no new beacon or analytics provider. Local previews have no injected production analytics. Keep mutation/layout QA on isolated local D1 and make only a small, identified release check on production. Do not equate requests or IPs with people, or claim a CSP fix proves analytics ingestion before checking the live release.

`site/network.js` replaces three independent public request wrappers. It provides one initial cookie barrier, timeouts and retry messages while existing idempotent mutation IDs preserve drafts across failures. The register's secure session and guest identity remain separate.


## Activity and topic proposals

Open `/crew` with the existing developer key. **Activity** shows 7/30-day community counts, daily activity, recent dispatches and unanswered/report/proposal shortcuts. **Suggestions** retains the existing moderation inbox. **Topic proposals** is private: edit the public title/intro, then **Publish topic**, or **Decline privately**. Approval creates a regular discussion page and displays its submitter prominently. Pending/declined proposals have no public page. Guest suggestions remain welcome.

Visitors use `/community#topics` to browse every published topic and `/community#propose-topic` to submit one privately. Your existing official notes are developer replies, highlighted in the public cards. They are not duplicated in the crew reply table.

Dashboard counts describe visible community records. Active votes are not historical page views. Visitor analytics are currently available through the dashboard's Cloudflare link, without embedding private Analytics credentials or adding tracking. Dates use Pacific calendar days; the current day is partial.

Apply additive migration0006 only after a private production export and local review; do not seed production from local QA. Normal publication remains commit/push to main → the existing Pages project.


## Knowing your current identity

The bar below navigation says **Developer access active · Fleet Command** only for a verified developer session. It also labels the separate community callsign or guest identity. The same code still unlocks `/crew` for8hours; no email or username was introduced. Expiry or Lock removes developer access.

**Updated [Pacific date/time] — Last developer login** is a presence timestamp, not a software-release date. It changes only on a successful developer-key login. **Latest developer replies** opens `/developer-replies`, showing current official notes across all topics in actual reply/edit order. Mere status and pin changes do not count as new replies.
