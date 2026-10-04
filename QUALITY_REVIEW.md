# Website quality review — October 2, 2026

## Activity dashboard and topic proposals — October 3, 2026

Local Chrome390x950 and1440x1000 passed the actual guest proposal form, private queue, owner publish form, attributed topic page, public idea/reply/vote flow, dashboard counts, attention shortcut and Lock. Screenshots inspected for the directory, owner dashboard, approval form, attribution and strongly highlighted developer reply. No horizontal overflow or runtime exceptions during this journey. The note count increased once for a new developer note and did not increase on editing it; recent activity identified the edit.

Focused local privacy checks passed guest and foreign-origin rejection, private declined404/public-list absence, stale revision409, request retry/idempotency, changed-payload conflict and atomic single publication. Literal HTML and template-token strings stayed escaped. Discovery showed different topics before repeats. These were local fixtures only, not public submissions or actual moderation decisions. Actual mobile-device acceptance remains Ryan's.

Authoring,24 JS syntax files,19 HTML documents and33 referenced local assets/fingerprint hashes passed; Pages Functions compiled. Migration0006 applied successfully in production after a private export. All previous fields and rows in14 persistent tables remained unchanged, including Ryan’s7 creator audit events and18 idea-history entries. The new proposals table was empty. Production export/preservation and deployment receipts live outside the repo in `../../Saved/SourceChanges/FleetActivityTopics_20261003`. Never publish its `private/` folder.



## Creator controls — October 3, 2026

Chrome local review at390x950 and1440x950 exercised the actual Fleet Command unlock form, inbox filter, required-note validation, saving Already in Game, navigation to a public discussion, inline suggestion/reply controls, saving/reloading, and Lock. The390px editor is350px wide with no horizontal overflow even when advanced drawers are open. Inbox, editor and public-note screenshots were visually inspected. No browser runtime exceptions in the completed journey; guests receive neither inline controls nor the lazily loaded editor script. The password input clears on unlock and the session cookie is inaccessible to document.cookie. This is desktop Chrome viewport evidence; actual phone acceptance remains Ryan's.

Focused local API verification passed guest authorization denial, exact-origin rejection, cookie persistence/revocation, required implementation notes, Already in Game exclusion from feedback feeds, unsafe-link/date rejection, stale-edit conflict, pin/move/hide/restore/lock, disclosed formatting edits, reply promotion/idempotency, duplicate vote deduplication, combined discussion, preserved source links/replies/authors, group flattening, merge-cycle rejection, all inbox filters and report resolution. Original text remained unchanged. All mutation fixtures stayed in isolated local D1; no public test activity was created. These bounded checks are not a claim of exhaustive security or device coverage.

Authoring,20 JavaScript syntax checks,18 HTML documents/32 local asset references and fingerprint hashes passed. The Pages Functions bundle compiled. All five migrations apply from scratch in local SQLite. The initial remote attempt rejected a CASE…END trigger body as incomplete SQL and fully rolled back; before/after comparison confirmed no rows or creator columns changed. The guard now uses equivalent SELECT RAISE…WHERE statements, matching the existing migration style. That form passed the local API merge review and remote migration0005 applied successfully (28 commands). SQL files are pinned to LF for future checkout consistency.

Production was exported to a private path outside the website repository before migration. Comparison across12 persistent tables confirmed all previous fields/rows unchanged:11ideas,5replies,10votes,11history rows,4profiles,8profile actors,4passkeys,4allegiance paths and existing registries. Newly created creator-session/audit tables were empty after migration. No existing status was reclassified; historical IMPLEMENTED entries need creator confirmation before receiving feedback credit. No DNS, subscriptions, hosting/account settings or commerce changes.

Evidence and final deployment receipts are kept outside public output at `../../Saved/SourceChanges/FleetCreatorControls_20261003`. The private SQL export and account-row snapshots must never be committed or served. Publication uses the existing GitHub main → Cloudflare Pages workflow; final production checks should be limited and counted separately from real visitors.

Reviewed the actual locally served page in an isolated headless Chrome session at **390×844**, **820×1180**, and **1440×1000**. Screenshots were visually inspected at all three widths. Two observed problems were fixed: the phone header's Steam item was overriding its hidden rule, and collapsed heading line breaks needed spaces. The revised browser pass confirms:

| Check | Result |
| --- | --- |
| Horizontal overflow | None at all three widths |
| Mobile Steam CTA | 350×48px; top about 390px, visible early |
| Homepage console/runtime errors | None |
| Broken homepage requests | None |
| Section anchors | All resolve |
| Damage clip playback | Browser reached readyState 4, no media error; Play becomes Pause |
| Blank Steam URL | All current CTAs say Steam page coming soon |
| Configured Steam URL | Browser-only injected value updates all three CTAs and status text; production remains blank |
| JavaScript disabled | Page, TikTok link, native video controls and navigation remain usable; no overflow |
| Reduced motion at desktop width | Hero paused; zero video requests at first view |
| Phone first view | Hero paused; no automatic video requests |
| External page requests | None; no font CDN or tracker |
| Static routes | Home, 404 document, favicon, manifest, robots, sitemap and social card all resolve |
| Missing URL | Custom 404 content served with HTTP 404 |
| Metadata | Canonical `https://fleetinpieces.space/`; 159-character description; 1200×630 social card |
| Deploy payload | About 2.70 MiB including all five videos; the full payload is not downloaded on a phone's first view |

Security headers were served by the local preview during the browser pass, including the same-origin Content Security Policy. The only logged 404 came from deliberately requesting a missing route. JavaScript syntax and HTML local asset/fragment references were also checked. No npm packages were added to the site.

The final visual style preserves Ryan's request for dimmer branding and near-black surfaces. The supplied logo/social card were checked for legibility; neither is generated gameplay.

Limits: this establishes local Chrome behavior, not a live Cloudflare deployment, Safari/iOS verification, a worldwide network-speed benchmark or acceptance of the game's simulation. The actual domain is still awaiting user-controlled provisioning. GitHub's existing credential returned 401 and Cloudflare credentials were unavailable, so remote publishing could not be verified. Ryan owns final copy, clip choice and phone appearance approval.

## Missile community review — October 3, 2026

Real Chrome at390x844 and1440x1000, backed by Wrangler's isolated local D1, confirmed no horizontal overflow, no JavaScript exceptions and no failed page/asset/API requests during ordinary loading. The390px suggestion textarea fits inside the initial844px viewport (top685px,bottom831px); the desktop textarea starts634px down. Footage stays paused with no automatic video data load. Canonical metadata uses the production domain.

A short local browser journey submitted an idea, voted, posted an anonymous reply, reported content, reopened `/i/1`, and opened the protected crew desk. Four concurrent repeat vote requests stayed at one vote. Developer status/response saved; hiding an idea made its API, thread URL and replies return404; restoring worked. Individual replies could be hidden/restored, reports resolved, and Lock removed private desk content. Markup in a developer response rendered literally. Failed link submissions retained editable drafts; draft/handle survived reload. Top/New controls and an independent browser read worked.

Focused local API checks confirmed idempotent retried submission, cross-origin403, oversized-body413, and rejection of obvious private email, honeypot and official-impersonation inputs. These checks cover the implemented flow, not exhaustive abuse resistance or real-world identity guarantees. Ryan's phone acceptance remains authoritative. No public review posts were created; production D1 was independently confirmed empty before release. Evidence lives outside the site at `../../Saved/SourceChanges/FleetWebsiteCommunity_20261003`.

Production verification: Community Phase1 is live at https://fleetinpieces.space/systems/missiles. GitHub main commit24ccaf440bc0611730350667aadcc1afcfdeef7c deployed successfully as CloudflarePages94733054-1523-48b9-978a-0eeef5f9c69c. ProductionD1 binding and encrypted secret names were verified;390/1440 custom-domain and Pages browser checks passed. Both apex/www use HTTPS and canonical missile URLs; the production crew key unlocked the empty inbox. Seven changed assets match committed Git hashes. Production contains no review posts. The custom domain retains a pre-existing Cloudflare-injected analytics beacon blocked by the self-only CSP; no new first-party script exceptions or ordinary failed requests were found. Deliberate missing-idea/private-key requests returned404. End-to-end writing/moderation was checked locally; live checks were read-only apart from session/rate bookkeeping.

## Game-first rebuild and native Quartermaster — October 3, 2026

Local Chrome review covered18 authored documents, with15 public routes at320/390/820/1440. No horizontal overflow, missing images, first-party exceptions or undersized main-navigation targets were observed. Home, missile briefing, Quartermaster, inline replies and service history screenshots were visually inspected. The final feature-video Play/Pause control was checked at390/1440 with actual playback, no media error and44px targets. Feature clips do not autoplay; native controls remain the no-JavaScript fallback. A missing `/register#return` destination was repaired. Local HTML asset/fragment checks, JavaScript syntax and `wrangler pages functions build` passed.

Guest journey passed locally: new carrier suggestion, offline error with retained draft, retry, rapid repeat clicks without duplicate vote/reply, inline reply, reload into the permanent thread, report, developer implementation status/filter, hide/restore and synchronized votes across discussion/history cards. Profile public history loaded the claimed original contribution. Browser checks used isolated local D1; no public review posts, votes or identities were created.

The existing virtual WebAuthn journey passed registration/explicit guest claim, signin, second passkey, recovery with key/session replacement, rotated-code rejection and public profile. Allegiance review formed a three-member tree, moved a whole branch, rejected a cycle and renounced while keeping descendants attached. An old review script initially used an obsolete admin header; correcting that local script allowed the existing Bearer-protected moderation check to complete. There was no application auth relaxation. Real-device prompts and sync remain Ryan's acceptance.

Quartermaster is native at `/quartermaster`, with the actual public shirt mockup, KESTRAL/DEGRADED labels, first/founding issue copy and verified starting priceUS$21. Only the purchase CTA leaves the site, directly to the exact Fourthwall product URL with `target=_blank` and `noopener noreferrer`. Desktop/mobile nav clicks remained native. Generic storefront-home links are absent. No cart/API integration, order metadata, purchase or checkout transaction was performed.

Production D1 was exported privately outside the website repository, then migration0004 inserted only four new content records. A before/after comparison across12 persistent tables confirmed every pre-existing row unchanged:11ideas,5replies,10votes,11history rows,4profiles,8profile actors,4passkeys,4allegiance-path rows, existing content/rank/type definitions. No production data was replaced or seeded from local QA. The export and sensitive row snapshots remain outside `site/`; only aggregate receipts are public-review evidence.

The existing Cloudflare-injected analytics beacon is now permitted by the narrow static/Function CSP changes. No account/hosting/DNS/paid setting changed. Live ingestion is not established by local build evidence; final production validation should stay small and be recorded separately. Release receipts and screenshots: `../../Saved/SourceChanges/FleetSiteRebuild_20261003`.

Remaining limits: actual iPhone/TikTok browser and Windows Hello/passkey-sync acceptance are Ryan's. Gameplay clips are authentic archive material, not current-build proof. Commerce stays provider-hosted; rank promotion policy, actual game-vessel assignment, external identity linking and a native cart remain future work.
