# Fleet in Pieces website

## Current handoff — activity dashboard and community topics, October 3, 2026

`/crew` now opens a private Activity dashboard with 7/30-day Pacific calendar views, visible ideas/replies, still-active deduplicated votes, first official developer replies, registrations, recent dispatches and attention shortcuts. Notes in `ideas.developer_response` ARE Ryan's official replies: keep their text and history in place, highlight them on cards, and do not copy them into anonymous reply rows. Updating a note appears as an update, not another first reply. Dashboard polling runs once per minute only while its view is visible and authorized. Lock clears private UI; every admin endpoint remains server-authorized.

Visitor traffic is not connected to this desk: the existing Cloudflare credential has no analytics scope. A safe link opens Cloudflare Web Analytics; no fake zeroes, inferred visitors, assistant-visit subtraction, new tracking or account settings. Community totals are not visitor traffic.

Home and `/community#topics` list all published topics alphabetically ahead of discussion feeds. Discovery interleaves ranked topics within the existing bounded candidate set. `/community#propose-topic` accepts guest or registered proposals into private `topic_proposals`. `/crew` → Topic proposals → Publish topic creates a real `content_objects` row and `/topics/{id}` discussion atomically; Decline keeps it private. Original title/body/submitter remain in the queue while the creator can edit the public title/introduction. Directory and topic page prominently credit the original callsign; registered proposers link to their profile, guest handles remain unverified. Publication opens discussion, not an implementation promise. No production proposals were approved as QA.

Migration `0006_topic_proposals.sql` adds only the private table, two indexes and publish trigger. It is now applied in production; do not reapply it. A private export preceded it, and every previous field/row in14 persistent tables compared unchanged afterward. No production topic proposals were created during review. Existing content IDs, idea/reply/vote rows, profiles and creator sessions are untouched. Dynamic topic HTML uses a single escaped-token replacement pass. The generic `/topic` shell is noindex; real `/topics/{id}` has canonical/OG metadata. Public APIs and pages never expose pending/declined proposals. New route is included in the repo's Pages Functions routes; do not change dashboard infrastructure.

Evidence: `../../Saved/SourceChanges/FleetActivityTopics_20261003`. Local Chrome390/1440 journey covered guest private proposal, owner dashboard/approval, prominent credit, idea/vote/reply flow, official-note counts and lock. Focused privacy checks covered declines, stale approvals, authorization/origin, idempotency and escaped literal tokens. Keep private production exports outside Git/site. See QUALITY_REVIEW.md and release receipt for actual deployment state.


## Current handoff — creator controls, October 3, 2026

Fleet Command `/crew` now exchanges the existing developer key for an eight-hour, server-verified HttpOnly / Secure / SameSite=Strict session on the canonical host. D1 stores only a token digest and key-version digest. Lock revokes the session; changing the existing admin key invalidates prior sessions. Community passkeys and guest participation remain separate. No creator role is automatically granted to a callsign. `site/creator.js` checks access and attaches small inline controls; the shared `creator-tools.js` editor is loaded only for authorized browsers. All privileged API actions are still server-protected, including direct requests.

Decisions are OPEN, UNDER REVIEW, PLANNED, PROTOTYPING, IMPLEMENTED FROM FEEDBACK, ALREADY IN GAME, NOT PLANNED, DUPLICATE and SUPERSEDED. Both implementation outcomes require a developer note on the server and in the form. Only explicit `decision_key='implemented'` enters feedback implementation lists/profile credit. Existing unclassified IMPLEMENTED records retain their historical badge but receive no assumed community credit; the inbox has a separate classification view. Do not mark public suggestions from examples in a brief without Ryan choosing that actual response.

Migration `0005_creator_controls.sql` is additive: original text/author IDs/vote rows/replies remain. Formatting changes use display fields plus a required visible edit note and expandable original. Moderation revisions and atomic audit triggers record edits; public history exposes summaries, never private before/after snapshots. Inline/inbox controls cover notes, pin, topic move, hide/restore, reply lock, build/date/HTTPS evidence, links, duplicate consolidation and attributed reply promotion. Stale revisions return409.

Consolidation links a source to a visible root, closes new source replies/votes, and keeps all original `/i/{id}` URLs. Root counts, replies and discovery combine visible sources while deduplicating claimed/anonymous voters. Raw rows and original authors stay with their original submission. Source per-author credit is not reassigned to the root author. Atomic triggers flatten a moved group, reject loops and cap a combined discussion at50 originals. Consolidation is intentionally permanent in this first UI; hide remains reversible. Promoting a reply is idempotent and preserves the original reply/author with backlinks. Adding/removing root votes updates the original stored per-idea counters for profile compatibility.

Local Chrome390/1440 inbox and inline save/lock review passed; screenshot evidence and bounded API data-preservation/security checks are at `../../Saved/SourceChanges/FleetCreatorControls_20261003`. No public review submissions. Run normal authoring/syntax/Functions bundle checks, export production privately before0005, and compare every old field of pre-existing records after migration (new additive columns differ intentionally). Never put export/keys/local fixtures into Git or `site/`. See QUALITY_REVIEW.md for the actual release state.

Production0005 applied successfully after a rejected CASE…END trigger variant was confirmed rolled back. Use the current SELECT RAISE…WHERE guard form; it matches the remote-compatible existing migrations. All pre-existing fields in12 production tables compared unchanged after the successful additive migration. Do not reapply0005 or copy local review fixtures to production.

## Current handoff — game-first rebuild and native Quartermaster, October 3, 2026

This pass replaces the old external Quartermaster navigation and the one-briefing homepage. Main navigation is Game / Systems / Ships / Community / Dev Log / Quartermaster. `/quartermaster` is native; its single purchase CTA opens the exact Fourthwall product URL in `site/config.js`, never the store homepage. `content/merch.json` contains verified product information and provenance. Use the actual `first-deployment-shirt.jpg` mockup, VESSEL: KESTRAL and OPERATIONAL STATUS: DEGRADED. Price starts at US$21, checked October 3; Fourthwall owns final variant pricing and guest checkout. No Storefront API/cart/order integration exists yet.

Author entry pages in `scripts/render-pages.mjs`, briefs in `content/systems.json` + `templates/system.html`, development updates in `content/development.json`, then run `node scripts/prepare-site.mjs`. The script emits all public entry pages, shared navigation, sitemap and immutable release assets. `/game` retains its approved masthead and authentic clips; briefings now cover missiles, damage, siege, carriers and rescue. Development log entries distinguish built/in-testing work from accepted gameplay. Do not invent additional content, implementations or rank rules.

Feature pages put a short game briefing above discussion, with inline replies and a composer beneath the first eight ideas. `site/network.js` centralizes timeout/error handling and serializes the first cookie-setting request across guest and identity clients. Votes synchronize across repeated representations; reply counts come from the server. Public profiles include paginated public contribution history; hidden content stays out. Existing passkey, claim and actual allegiance-tree mechanics remain authoritative. Rank starts at Recruit; promotion rules and real-game vessel assignment are still future work.

Migration `0004_game_briefings.sql` only inserts four content registry entries, with no sample posts and no updates to existing discussions/accounts. Export production D1 privately and verify existing rows before/after any production migration. Do not copy local QA data to production. The legacy `ideas.system` CHECK remains missiles; `content_id` is the actual ownership field for all five briefings. Preserve it deliberately.

The existing Cloudflare-injected analytics beacon had been blocked by CSP. Static and Function response policies now allow only its required script/connection origins. No account setting or extra tracker was added. Keep browser QA local and record the small number of final production verification requests so Ryan can interpret metrics.

Local evidence: `../../Saved/SourceChanges/FleetSiteRebuild_20261003`. Chrome layouts checked at 320/390/820/1440; guest post/reply/vote/reload/offline retry, report/hide/restore, implemented views, profile history, virtual passkey/recovery/claim, and whole-branch allegiance/cycle checks passed. No public QA activity. Real-phone biometrics/passkey sync and game acceptance remain Ryan's. See QUALITY_REVIEW.md for release evidence; do not infer live status from this source note alone.

## Historical handoff — community expansion, October 3, 2026

**Community expansion is live; real-device acceptance remains Ryan's.** Published through GitHub main commit `3293639b39af460f181135fb735f694af08873dd`, Cloudflare deployment `1a0b0abb-3c18-4284-899b-1c9dc6dc62c4` (October 3, 2026). Apex and www HTTPS, Register API/RP, Pages noindex/canonical-host auth guard, original /i/1, canonical/OG resources, release asset hashes and 390/1440px layouts verified in Chrome. All original 10 ideas, 2 replies, 10 votes and 10 history rows compared unchanged after migrations 0002/0003. Local anonymous posting/reply/vote/report, developer implementation filter/discovery, native WebAuthn with virtual credentials (signup/signin/add key/recovery/claim), profile and whole-branch move/leave/cycle checks passed. No public QA identities/posts. Ryan owns real-phone/Windows Hello prompts and passkey sync acceptance. Evidence: `../../Saved/SourceChanges/FleetCommunityExpansion_20261003`.

Read README.md and COMMUNITY_ARCHITECTURE.md before detailed work. This repository is separate from the older private Sites prototype in `../FleetInPieces`; do not publish it through Sites or copy that project's `.openai` identity.

## Hosting and source boundaries

Keep the existing Cloudflare Pages project `fleet-in-pieces-site`, GitHub repository `ryancroker/fleet-in-pieces-site`, production branch `main`, framework None, blank build command and output `site`. Apex `fleetinpieces.space` and `www.fleetinpieces.space` already have domain associations. Do not repeat DNS setup, create a replacement project, force-push, change paid plans or alter account settings for routine site work.

Pages Functions run on the Workers runtime, with production D1 `COMMUNITY_DB`. Routes are `/api/*`, `/i/*`, `/u/*` and `/topics/*`; other pages/media are static. `wrangler.toml` intentionally gives previews no production database. Use local D1 for review. Only `site/` is public static output; server code, game source, local database state, secrets and QA profiles stay outside it.

Use **Node 22** and `npm ci` for locked authoring dependencies. Run `node scripts/prepare-auth.mjs` after dependency changes and commit `functions/_lib/vendor/` plus its license notices. Pages with the required blank command skips npm installation, so identity.js imports this prepared server-only bundle. esbuild 0.28.2 is a pinned local authoring dependency only. `@simplewebauthn/server` is explicitly authorized and pinned to **14.0.3**; it verifies passkeys server-side. Browser authentication uses native WebAuthn. Keep HTML/CSS/vanilla JS: no frontend framework, font CDN, analytics or unrelated dependencies without Ryan's instruction. A local authoring step is now part of this repo even though the Pages build command remains blank.

## Authoring and release caching

Run `node scripts/prepare-site.mjs` after changes to authored content, HTML, CSS or browser JS. It generates system briefings from `content/systems.json` and `templates/system.html`, applies shared navigation, writes UTF-8/LF content-fingerprinted CSS/JS release files and updates HTML references. Review generated output alongside the source. Edit the content/template for lasting missile-page changes, rather than only the generated `site/systems/missiles.html`.

The script replaces the former manual three-page community-CSS fingerprint process. Keep stable source filenames editable and retain previous hashed assets for cached HTML; never rewrite an existing fingerprinted asset. Ryan's desktop regression was reproduced by new HTML plus old community CSS, and the custom domain returned a longer cache lifetime than source headers requested. Check the loaded fingerprinted URL and a returning-browser reload, not only a fresh browser. No account-level cache change is needed for this release convention.

## Pages and community behavior

`/` is a real branded game/community homepage with bounded trending and recently implemented sections; it no longer redirects to missiles. `/game` preserves the full marketing overview and authentic media. `/systems` lists available briefings, `/community` provides bounded discovery, `/fleet` introduces the register and callsign lookup, and `/register` manages optional identity. Primary navigation is Game / Systems / Ships / Community / Dev Log / Quartermaster; identity links remain in community content and grouped footers.

`/systems/missiles` is the first reusable content briefing: CURRENT, prominent authentic footage, contribution form, discussion and real implemented-from-feedback history. Five authentic briefings are registered: missiles, damage, siege, carriers and rescue. Do not invent ship catalogs, activity, vote counts, implementations or release promises. The clip is archived authentic development footage, not proof of today's game build.

Keep browsing, voting, ideas and replies available without an account. Idea submission remains an 8–2,000 character body with optional handle and no title/category/tag/email requirement. Use real D1 persistence, never fake localStorage community data. Top is the default; New, Dev responded and Implemented are additional filters. Reports open on demand rather than occupying every card. `/i/{id}` remains the permanent full idea/thread URL.

Stable `content_objects.id` owns the discussion; `system-missiles` must not change when a title/slug changes. Migration 0002 is additive and retains legacy system values, existing ideas/replies/votes and their IDs. Only the ordinary idea contribution type is enabled. Add new real content through both the authored template data and an additive registry migration, with matching stable IDs and redirects for renamed paths.

Fleet Command's current decisions are described above. Preserve historical labels; do not infer implementation credit from old normalized states. Discovery returns at most six trending and four explicitly implemented-from-feedback ideas; empty data has honest empty states. Votes represent enthusiasm, not command authority.

## Optional identity and allegiance

Migration 0003 adds passkey identities, opaque UUID profiles, explicit browser-activity claims and allegiance. Registration uses a callsign, not email/passwords. Anonymous signed-browser cookies remain independent from login cookies. A profile starts as Recruit; rank configuration and promotion eligibility are separate, with no automatic promotion threshold. Vessel assignment remains empty; no browser combat or fitting system is built.

Keep challenge consumption, exact origin/RP checks, user verification, counter checks, session-version guards and secure HttpOnly cookies. Recovery codes are high entropy and shown once; only hashes are stored. Recovery requires a new passkey, replaces old keys/sessions and rotates the code. Do not log or expose recovery codes, session tokens, private keys or credential material in public profiles. Local passkey review must use `localhost`; production uses the canonical game domain, not temporary Pages hosts.

Claims are explicit and limited to activity owned by the same signed browser token. Preserve raw historical actors and vote rows; count linked aliases as one profile's vote. Public author links use `/u/{uuid}`. Callsigns are public labels, not verified real-world identities.

Swear Allegiance moves the whole subordinate branch, and leaving retains that branch. Preserve atomic closure-table guards against cycles and the current bounds of 12 levels/2,000 members per connected command tree. More advanced politics, commissions and automatic promotions remain future work.

See **[COMMUNITY_ARCHITECTURE.md](COMMUNITY_ARCHITECTURE.md)** for commerce separation. The native Quartermaster page links directly to the external Fourthwall product; there is **no embedded store or account-purchase integration**. Checkout must allow guests and keep payment, tax, customer email, shipping and fulfillment with a provider. An optional server-controlled opaque profile association must not turn community authentication into a customer-data system. No provider API, order table, webhook or purchase badge is active.

## Moderation, release and acceptance

Protect `/api/admin` on the server, not by hiding `/crew`. Secrets COMMUNITY_ADMIN_KEY and COMMUNITY_SIGNING_KEY belong in encrypted Cloudflare settings; `.dev.vars` and `.community-admin-key.txt` stay ignored. Keep the signing secret stable across releases. Public text stays plain text, profanity is allowed, and reports/human moderation handle contextual abuse. Preserve origin checks, request idempotency, rate limits, parameterized SQL and hide/restore behavior.

Before production migration, export D1 privately outside `site/`, record existing IDs/counts, apply only reviewed migrations not already applied, and verify preservation before deploying the new Functions. Do not rebuild/drop production tables or replace D1 for a frontend rollback. No public test posts or identities: review against isolated local D1.

Ryan requested small real-browser website checks around 390px and desktop widths; do not replace them with elaborate internal harnesses. Successful syntax/bundle checks do not establish live behavior. Ryan owns real-phone/passkey acceptance; virtual credentials do not prove platform sync or biometric prompts. Keep future release receipts scoped to what was actually checked.

## Branding and authentic media

Keep the dark graphite/naval style, readable typography, restrained dividers and dim approved logo. Use `site/assets/logo/fleet-in-pieces-transparent.webp` (1348×240, RGBA, 33738 bytes), never the opaque original. Preserve `/game`'s approved centered desktop masthead, compact phone/tablet logo, graphite/navy gradient and pale-blue CTA. Existing hero evidence is in `../../Saved/SourceChanges/FleetWebsiteHero_20261002`; it is historical evidence, not new-release acceptance.

External destinations are configured in `site/config.js`; authored pages/templates also contain deliberate static TikTok fallbacks. Blank Steam URL stays an honest coming-soon state. Do not invent app IDs, contact addresses, dates or feature promises. Unknown socials stay unavailable.

Read ASSET_CHECKLIST.md and MEDIA_SOURCES.md before changing clips. Use authentic silent gameplay and preserve native aspect ratios. Website work does not authorize new game/editor launch, filming, game-source changes or packaging full recordings. Keep gameplay-frame acceptance separate from browser-layout review.
