# Community and Fleet Register

This is a game-development community attached to specific content, not a general social feed. Guest browsing, voting, ideas and replies must remain available. The brief for this pass is Ryan's October 3 community expansion, amended to require passkeys and separate future commerce.

## Content and history

`content_objects.id` is the permanent discussion owner. The initial object is `system-missiles`; its title, slug and URL may change without moving or renumbering ideas. `/i/{id}` remains the permanent idea URL. Migration 0002 adds the registry and backfills existing missiles ideas; it does not recreate the ideas, replies or votes tables. The old `system` column remains solely for old clients and rollback compatibility. New code uses `content_id`.

`contribution_types` is the extension point for future names, doctrine, lore or other submissions. Only ordinary ideas are enabled now. Do not add extra fields to the missile composer to anticipate those types.

The reusable static briefing comes from `content/systems.json` and `templates/system.html`. To add a real content page, add its authored content and an additive registry migration using the same stable ID. Publish only systems/ships with verified game information and real media. Renaming requires a redirect from the old page path; the content ID and idea URLs stay fixed.

Fleet Command decisions use a separate `decision_key`, mapped to the existing normalized statuses for compatibility. Existing labels/replies stay intact. Only explicit `decision_key='implemented'` appears in feedback implementation records and profile credit; `already_in_game` never does. Both outcomes require a developer note. Legacy unclassified implemented records retain their badge and are presented for creator classification, without inventing their provenance. Empty records have honest empty states.

Homepage discovery is bounded: six active ideas and four implemented ideas, no infinite scroll or fabricated activity. System discussions keep Top as their default and provide New, Dev responded and Implemented filters. The renderer is shared between discovery and individual content feeds.

## Optional identity

The register uses a callsign and device passkeys, without email or passwords. `@simplewebauthn/server` is pinned as a server-only cryptographic dependency; browser code uses the native WebAuthn API. There is no external auth service or frontend framework. Credentials are verified against challenges, origins, RP IDs and user verification; sessions are secure HttpOnly cookies. The RP is the canonical game domain. Temporary Pages deployment hosts must direct registration to that domain.

Profiles have stable opaque UUIDs. Callsigns are public names, not proof of a real-world identity. A registration can explicitly claim anonymous activity owned by the same browser token. Registered activity is associated with a profile; guest activity remains valid. Raw historical vote rows are retained, with claimed aliases counted as one registered voter's support.

Recovery codes are high-entropy secrets shown once; D1 stores only their secure hashes. Recovery requires enrolling a new passkey and rotates the old code. A second passkey can be attached. Losing all passkeys and the recovery code may mean losing access. The register explains this before enrollment. Never put recovery codes, session cookies or private keys in logs, URLs, analytics or public profile data.

Rank definitions are data-driven. The only seeded starting rank is Recruit; there is no automatic promotion rule. Promotion eligibility and actual rank are separate fields. Profiles display actual contribution totals, allegiance and an empty vessel assignment. There is no browser combat, fitting system or fake ship ownership.

Allegiance is a single parent with an indexed transitive closure. Moving or leaving transfers the whole subordinate branch. Atomic database guards prevent self/descendant cycles, including simultaneous opposing moves. Initial operational limits are 12 levels and 2,000 members per connected command tree, with a visible unavailable reason. These are safety bounds, not final political mechanics.

## Commerce stays separate

**Quartermaster** navigation, grouped footers and the secondary homepage notice lead to native `/quartermaster`. Only its purchase CTA opens the exact Fourthwall first-shirt product URL; the generic store homepage is not part of the intended flow. `content/merch.json` holds the actual mockup and verified product data independently from the outbound URL. There is no native cart or community-to-order integration. Merchandise must allow guest checkout without a Fleet identity or allegiance.

A dedicated checkout/print-on-demand provider will own payment, tax, receipts, customer email, shipping address and fulfillment. Do not add those fields to Fleet profiles or collect card information in this application.

If a logged-in member chooses to associate a purchase, the backend may pass their opaque `profiles.id` through provider-supported, server-controlled checkout metadata. Do not accept an arbitrary client-supplied user ID as purchase ownership. A future authenticated, idempotent provider webhook may record only the required community ID, product ID, order status, purchase date and optional provider order ID. Verify webhook signatures and deduplicate events before granting any purchase mark. Keep private provider-order identifiers out of public profiles.

The bridge must be optional. Community authentication must never start requiring email because checkout does. The Fourthwall link does not activate a provider API, order table, webhook, purchase badge or customer-data integration.

## Prepare and publish

Run `node scripts/prepare-site.mjs` after changing authored content, HTML, CSS or browser JS. It emits the static briefing and content-fingerprinted CSS/JS, then updates every HTML consumer. It uses only Node built-ins and is an authoring command; the Cloudflare build command remains blank and output stays `site`. Keep old fingerprinted assets for cached pages. Stable source filenames remain editable and available for old clients.

After dependency changes, install the lockfile and run `node scripts/prepare-auth.mjs`; commit the server-only bundle and third-party license notices in `functions/_lib/vendor/`. The required blank Pages build command skips dependency installation, so production imports this prepared module instead of resolving an npm package. Pinned esbuild is only a local authoring dependency. Keep Pages preview disconnected from production D1. Use local D1 for registration, recovery, allegiance and posting review; do not seed public identities or discussions for QA.

Before the first production migration, export the live D1 database to a private local path outside the public site, record current row counts and existing IDs, apply the additive migrations, and confirm those historical records are unchanged before deployment. Keep the signing secret stable. Do not drop tables, replace databases or alter DNS/paid plans as part of this work.

Ryan owns real-device passkey prompts and phone acceptance. A successful server bundle or virtual browser credential proves neither platform sync nor every device's biometric UX.

## Creator controls

Migration0005 adds creator metadata, revision counters, audit events and hashed creator sessions. The existing admin key unlocks an eight-hour HttpOnly/Secure/Strict cookie on the canonical host. D1 stores a keyed digest of the random token and a digest of the current admin key version; rotation invalidates prior sessions. Localhost uses its own non-Secure development cookie. No community account is implicitly an administrator, and no external identity/provider infrastructure is added. Exact-origin JSON mutation checks, constant-time key verification, no-store responses and existing rate limits remain active. Creator JavaScript is progressively loaded only after authorization, but the API enforces authorization independently.

Original idea/reply bodies and attribution never change. Display title/body overrides require a public edit note and keep the original accessible. A single revision-guarded UPDATE fires an audit trigger so metadata changes and their history cannot separate. Admin history retains before/after fields; public history returns compact action summaries without private snapshots or previously removed note content. Supporting links allow HTTPS or local absolute paths only, with safe external-link attributes and no remote server fetch.

Duplicate consolidation sets `merged_into` rather than copying/deleting original activity. A root aggregates visible source votes, deduplicated through the existing profile-actor aliases, and source replies. Original source URLs stay readable but closed to new votes/replies and link to the root. An atomic trigger validates the root and flattens any existing source branch; cycles are rejected and groups are capped at50 originals. Source author history remains attributed to the source, not reassigned to the root. Unvoting the root removes that voter's owned votes across the group; stored own-idea counters remain compatible with profile counts. Public listing/discovery excludes merged source cards and uses combined support. Reply promotion copies its original text and author once, records `source_reply_id`, preserves the reply and emits backlinks. Unique indexing makes repeated promotion idempotent.

## Rebuild additions — October 3, 2026

Migration 0004 inserts four content records only: damage, siege, carriers and rescue. It leaves every existing row and schema intact. `content_id` remains authoritative; the legacy `ideas.system` value is intentionally unchanged. Public feed clients request a bounded page of eight ideas. Inline replies reuse the permanent thread renderer and server reply counts; votes synchronize across multiple cards for the same idea.

`GET /api/profiles/{uuid}/activity` returns up to25 public suggestions/replies, with plain-text snippets, original thread links and pagination. Hidden replies, hidden parent ideas and private content objects are excluded, including from public profile totals. This is a read model over existing ownership; no second contribution or reputation system is introduced.

Optional allegiance remains a single superior plus closure-table descendants, never generic following. Rank configuration is unchanged; there is no50-person automatic progression. A future real-game vessel registry should reference the stable profile UUID and game definition/version identifiers, with assignment/history separate from authentication. No fake avatar vessel, browser fitting or combat is implemented. Existing contribution type IDs can later distinguish lore/name submissions without treating votes as canon authority.

For a future Fourthwall Storefront API, replace the product data source and purchase adapter while leaving native presentation routes intact. Provider checkout/fulfillment remains separate; do not collect commerce PII in community tables or expose provider secrets to browser code. Current direct guest checkout requires no integration or Fleet login.


## Private topics and activity read models

`topic_proposals` stores original private proposal text, immutable proposer identity/browser attribution, review status/revision and separately edited publication fields. Normal public POST uses existing session, exact-origin, plain-text screening, request UUID and bounded actor/IP rate limits. Admin GET/PATCH use existing creator authorization. Approval updates a revision-checked row; a D1 trigger creates the stable `community-topic-{id}` registry row in the same transaction. Pending/declined proposals never join public content. Approved topics reuse existing idea/reply/vote ownership via `content_id`; the legacy `ideas.system` compatibility field is unchanged.

The creator dashboard is a private read model over existing D1 records. It deduplicates claimed/merged votes, omits promoted copies from new submission counts and reads developer-note changes from history. A current nonempty note contributes one first-reply event; later edits appear only in recent dispatches. No raw ownership/session secrets are returned. Totals exclude hidden community content; this is operational activity, not a visitor counter. No Analytics token, user tracking table or commerce fields were added.


## Developer presence

Migration0007 adds one `developer_presence` row. Successful creator login atomically advances its timestamp with session creation, using a monotonic update against concurrent older requests. Migration can recover the most recent login from an existing session's fixed8-hour expiry; absent evidence remains null. Reads/Lock do not advance it. The session status endpoint exposes no token, digest, key version or profile authorization; developer authority and passkey profile identity remain separate. The client expires its indicator and rechecks on visible-tab/BFCache return.

The latest developer replies endpoint reuses public idea serialization and existing note history. It filters hidden/private content (including hidden merged roots), orders actual nonempty note changes, and returns12items plus a has-more flag. It never republishes audit snapshots or historical withdrawn notes.
