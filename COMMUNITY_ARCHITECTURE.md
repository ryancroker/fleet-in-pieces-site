# Community and Fleet Register

This is a game-development community attached to specific content, not a general social feed. Guest browsing, voting, ideas and replies must remain available. The brief for this pass is Ryan's October 3 community expansion, amended to require passkeys and separate future commerce.

## Content and history

`content_objects.id` is the permanent discussion owner. The initial object is `system-missiles`; its title, slug and URL may change without moving or renumbering ideas. `/i/{id}` remains the permanent idea URL. Migration 0002 adds the registry and backfills existing missiles ideas; it does not recreate the ideas, replies or votes tables. The old `system` column remains solely for old clients and rollback compatibility. New code uses `content_id`.

`contribution_types` is the extension point for future names, doctrine, lore or other submissions. Only ordinary ideas are enabled now. Do not add extra fields to the missile composer to anticipate those types.

The reusable static briefing comes from `content/systems.json` and `templates/system.html`. To add a real content page, add its authored content and an additive registry migration using the same stable ID. Publish only systems/ships with verified game information and real media. Renaming requires a redirect from the old page path; the content ID and idea URLs stay fixed.

Fleet Command presets map to existing normalized statuses. Custom labels and existing replies stay intact. POPULAR is an explicit editorial status, not a made-up vote threshold. Only ideas actually marked IMPLEMENTED appear in implementation records. Empty records have honest empty states.

Homepage discovery is bounded: six active ideas and four implemented ideas, no infinite scroll or fabricated activity. System discussions keep Top as their default and provide New, Dev responded and Implemented filters. The renderer is shared between discovery and individual content feeds.

## Optional identity

The register uses a callsign and device passkeys, without email or passwords. `@simplewebauthn/server` is pinned as a server-only cryptographic dependency; browser code uses the native WebAuthn API. There is no external auth service or frontend framework. Credentials are verified against challenges, origins, RP IDs and user verification; sessions are secure HttpOnly cookies. The RP is the canonical game domain. Temporary Pages deployment hosts must direct registration to that domain.

Profiles have stable opaque UUIDs. Callsigns are public names, not proof of a real-world identity. A registration can explicitly claim anonymous activity owned by the same browser token. Registered activity is associated with a profile; guest activity remains valid. Raw historical vote rows are retained, with claimed aliases counted as one registered voter's support.

Recovery codes are high-entropy secrets shown once; D1 stores only their secure hashes. Recovery requires enrolling a new passkey and rotates the old code. A second passkey can be attached. Losing all passkeys and the recovery code may mean losing access. The register explains this before enrollment. Never put recovery codes, session cookies or private keys in logs, URLs, analytics or public profile data.

Rank definitions are data-driven. The only seeded starting rank is Recruit; there is no automatic promotion rule. Promotion eligibility and actual rank are separate fields. Profiles display actual contribution totals, allegiance and an empty vessel assignment. There is no browser combat, fitting system or fake ship ownership.

Allegiance is a single parent with an indexed transitive closure. Moving or leaving transfers the whole subordinate branch. Atomic database guards prevent self/descendant cycles, including simultaneous opposing moves. Initial operational limits are 12 levels and 2,000 members per connected command tree, with a visible unavailable reason. These are safety bounds, not final political mechanics.

## Commerce stays separate

There is no shop in this release. Future navigation may call it **Quartermaster**. Merchandise must allow guest checkout without a Fleet identity or allegiance.

A dedicated checkout/print-on-demand provider will own payment, tax, receipts, customer email, shipping address and fulfillment. Do not add those fields to Fleet profiles or collect card information in this application.

If a logged-in member chooses to associate a purchase, the backend may pass their opaque `profiles.id` through provider-supported, server-controlled checkout metadata. Do not accept an arbitrary client-supplied user ID as purchase ownership. A future authenticated, idempotent provider webhook may record only the required community ID, product ID, order status, purchase date and optional provider order ID. Verify webhook signatures and deduplicate events before granting any purchase mark. Keep private provider-order identifiers out of public profiles.

The bridge must be optional. Community authentication must never start requiring email because checkout does. No commerce provider, order table, webhook, purchase badge or customer-data integration is activated by this pass.

## Prepare and publish

Run `node scripts/prepare-site.mjs` after changing authored content, HTML, CSS or browser JS. It emits the static briefing and content-fingerprinted CSS/JS, then updates every HTML consumer. It uses only Node built-ins and is an authoring command; the Cloudflare build command remains blank and output stays `site`. Keep old fingerprinted assets for cached pages. Stable source filenames remain editable and available for old clients.

Install the pinned server dependency from the lockfile before local Pages bundling. Keep Pages preview disconnected from production D1. Use local D1 for registration, recovery, allegiance and posting review; do not seed public identities or discussions for QA.

Before the first production migration, export the live D1 database to a private local path outside the public site, record current row counts and existing IDs, apply the additive migrations, and confirm those historical records are unchanged before deployment. Keep the signing secret stable. Do not drop tables, replace databases or alter DNS/paid plans as part of this work.

Ryan owns real-device passkey prompts and phone acceptance. A successful server bundle or virtual browser credential proves neither platform sync nor every device's biometric UX.
