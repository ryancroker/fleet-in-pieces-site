# Fleet in Pieces

Production static website for **https://fleetinpieces.space**. HTML, CSS and a small vanilla JavaScript enhancement. No framework, package manager, build step, external fonts, analytics, database, backend, cookies or signup form.

## Preview locally

With Python 3 already installed:

```powershell
python preview.py
```

Open **http://127.0.0.1:4173/**. Stop with Ctrl+C. The optional preview server reproduces the custom 404 and path-based security headers. It is a development convenience outside `site/`; Cloudflare serves only static files.

## Cloudflare Pages settings

The existing Git-integrated Pages project uses these settings. Reuse it rather than creating a duplicate.

| Setting | Value |
| --- | --- |
| Project name | `fleet-in-pieces-site` |
| Production branch | `main` |
| Framework preset | `None` |
| Build command | **Leave blank** — no build |
| Build output directory | `site` |
| Root directory | Leave blank / repository root |
| Server secrets | `COMMUNITY_ADMIN_KEY`, `COMMUNITY_SIGNING_KEY` (encrypted) |

Cloudflare's Git integration guide explicitly allows a blank command for a site without a build. The Pages site is verified. The custom domain and both domain associations are active. DNS setup is complete. No paid feature is required.

Official references: [Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/), [build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/), [custom headers](https://developers.cloudflare.com/pages/configuration/headers/).

## CUSTOM DOMAIN LIVE — October 2, 2026

Live at **[fleet-in-pieces-site.pages.dev](https://fleet-in-pieces-site.pages.dev/)** from the public repository **[ryancroker/fleet-in-pieces-site](https://github.com/ryancroker/fleet-in-pieces-site)**. Git-backed production deployment `cf9447e2-7a97-4501-8772-bad7372aeb93` succeeded from `main` commit `2a2bc509c8bf213f561e08b374755b32d74e2551`. GitHub and Cloudflare authentication/integration work. Reuse this repository and Pages project; do not force-push.

Live Chrome review at 390×844 and 1440×1000 found no overflow, home-page errors or failed requests. Videos play; the phone hero starts paused and desktop autoplay works. All 24 public assets match local hashes. HTTPS is valid, the Pages address has `noindex`, metadata resources return 200, and the custom 404 works. Python urllib received Cloudflare error 1010; the successful verification used Chrome. JSON receipts/screenshots: `../../Saved/SourceChanges/FleetWebsiteDeployment_20261002`.

**Custom domain is live.** Ryan completed DNS setup; both `fleetinpieces.space` and `www.fleetinpieces.space` are active in Pages, and the apex site was verified in Chrome over HTTPS. Visual edits ship through the existing GitHub `main` integration. Do not change DNS or hosting infrastructure for these edits.

## External links — one obvious file

Edit **`site/config.js`**:

```js
SITE_URL: 'https://fleetinpieces.space',
STEAM_URL: '',
TIKTOK_URL: 'https://www.tiktok.com/@fleet_in_pieces',
YOUTUBE_URL: '',
CONTACT_EMAIL: '',
```

Paste the real HTTPS Steam store URL into `STEAM_URL`, commit and push. Every Steam CTA, the Steam social button and the availability text update automatically. Until then the main CTAs lead to an honest coming-soon explanation. No fake app ID, date, price, multiplayer promise or review score is shipped. The dummy URL used in local QA was injected into an isolated browser only and is absent from the production files.

Unknown YouTube/contact links are hidden; the footer has a plain contact-coming-soon note. There is no email signup, per Ryan's decision. The static TikTok anchor is a deliberate no-JavaScript fallback to the currently confirmed handle. If the TikTok handle itself changes, update that one fallback in `index.html` as well as the config. All page content, section links, native video controls and current TikTok access work without JavaScript. Keep the canonical/OG URLs, robots and sitemap fixed to the purchased production domain; `SITE_URL` is its documented value, not a runtime rewrite of crawler metadata.

## Media

All required logo, posters, clips, social card and icons are included. See **[ASSET_CHECKLIST.md](ASSET_CHECKLIST.md)** for exact filenames, optional landscape-hero inputs and replacement targets. **[MEDIA_SOURCES.md](MEDIA_SOURCES.md)** documents the existing footage and edits. No watermarked social download, third-party music or generated gameplay is used. Videos have no audio track.

The included hero is portrait. An optional clean landscape background can be enabled with `HERO_WIDE_VIDEO` and `HERO_WIDE_POSTER` in the same config, after placing those files at their documented paths. Leave both blank until supplied; there are no requests for missing placeholders in the current site.

Only the hero can autoplay, and only above 600px with normal motion/data preferences. Phones, reduced motion, data saver and slow connections stay on the poster until Play is pressed. Feature clips always wait for Play. All clips pause out of view or when the tab is hidden; playing one pauses the others. Native controls remain available if JavaScript fails.

## Files and behavior

- `site/` contains the public static assets, including six compact gameplay clips. Root `functions/` adds the community API and shareable idea routes.
- `index.html`, `styles.css`, `script.js`, `config.js` define the page.
- `404.html` is the actual missing-page response on Pages; it prevents accidental SPA-style fallback.
- `robots.txt` and `sitemap.xml` use the canonical domain; the sitemap lists the home page and missiles page. Private tools and API routes are not indexed.
- `site.webmanifest`, SVG favicon and PNG icons are included. This is a website, not an offline app; no service worker is installed.
- `_headers` supplies a self-only CSP, frame protection, MIME protection, referrer policy and restricted unused browser permissions. It also prevents indexing temporary Pages hostnames.
- CSS/JavaScript revalidate on every visit. Stable media filenames cache for one hour, without `immutable`. If replacing a media file immediately after launch, rename/version it and update its references to avoid stale browser copies.

## Review

See **[QUALITY_REVIEW.md](QUALITY_REVIEW.md)** for the completed browser checks and their limits. The local review uses the machine's existing headless Chrome and existing tooling outside this repository; no npm dependency is part of the site.

## Custom domain and hero update

The domain connection is complete. Use https://fleetinpieces.space/ as the canonical address; www is also active. Do not repeat provisioning steps or change DNS/hosting settings for visual edits.

The October2 hero update uses the approved transparent RGBA wordmark as an820px centered desktop masthead above the headline/gameplay columns. Phone/tablet layouts retain the compact inline logo. The graphite/navy gradient, tighter phone spacing and tiny red divider preserve the pale-blue CTA hierarchy. The existing GitHub integration deployed commit `4aacdf5efca6344a12e33d931bdf7393fedd1a42` successfully as deployment `4ad81ccd-25dc-4898-a827-cdb06588c1e7`. See MEDIA_SOURCES.md for the logo provenance.

## Community — missiles first

`/systems/missiles` is the first system discussion. Visitors can post instantly, vote, reply and report without an account. Names are optional and unverified; an empty name becomes Anonymous Crew Member. Handles and drafts stay in browser storage; public posts live in D1. Short links `/i/<id>` retain the original discussion. There are no sample posts or synthetic votes in production.

A small Pages Functions layer runs on Cloudflare's Workers runtime. `_routes.json` invokes it only for `/api/*` and `/i/*`; the marketing page, media and system page remain static. The existing GitHub main → Pages workflow, blank build and output `site` remain in place. `wrangler.toml` defines production D1 and intentionally disables D1 access in preview deployments. Do not bind previews to production for testing.

### Developer desk

Open **https://fleetinpieces.space/crew** and enter the key from the local ignored `.community-admin-key.txt` file. The page holds it in memory only; Lock or reload clears it. The API verifies it on every privileged request. Do not paste this key into a public idea, screenshot, commit or URL. If the file is lost, rotate COMMUNITY_ADMIN_KEY using Wrangler rather than trying to recover the cloud secret. Keep COMMUNITY_SIGNING_KEY stable across releases: rotating it invalidates existing anonymous browser identities and their ability to remove old votes.

Use Ideas & responses to set a real status, optional custom label and developer response. Use Reports to inspect reported content, hide/restore it and resolve a report. Original text and author credit remain intact; status/response changes are recorded in D1. Hidden ideas and their replies disappear from public API/thread pages. Votes represent enthusiasm, not command authority.

### Local development

Use the installed Wrangler CLI (or `npx wrangler` where available). The repository itself has no npm/runtime package dependencies:

```powershell
npx wrangler d1 migrations apply COMMUNITY_DB --local
npx wrangler pages dev site --ip 127.0.0.1 --port 4174 --d1 COMMUNITY_DB=a27dbf92-3ecb-4b41-9428-2d76ba7a558e
```

The explicit local `--d1` override is needed because Pages dev uses preview settings; it still uses isolated local storage. The compatibility date is pinned to the installed runtime, May22,2026.

Create an ignored `.dev.vars` with separate local values for COMMUNITY_ADMIN_KEY and COMMUNITY_SIGNING_KEY. Never use the production admin key in local QA fixtures. Local data persists in ignored `.wrangler/state`; the `--local` database is isolated from production. The original `preview.py` is suitable for static layout only; community actions require Wrangler.

### Publishing schema and code

Apply reviewed additive migrations before pushing code that needs them:

```powershell
npx wrangler d1 migrations apply COMMUNITY_DB --remote
git add <the reviewed source files>
git commit -m "Describe the community change"
git push origin main
```

Verify the Git-backed deployment and the actual custom-domain page/API. Do not force-push or replace the Pages project. A static-only rollback can temporarily leave discussions unavailable while keeping D1 data; never drop database tables as part of a frontend rollback. Before destructive schema work, export D1 to a private, ignored path and review Cloudflare's current recovery documentation.

### Abuse and privacy boundaries

A signed browser cookie limits casual repeat votes. Server-side rate limits apply to both browser identity and a daily salted IP hash; raw IP addresses are not stored by this application. Clearing cookies is not identity verification, and shared-network limits can affect several visitors. Public names are not verified identities.

Profanity is allowed. Public text is never interpreted as HTML. Obvious outside links/private-information patterns and a hidden spam field are checked; contextual abuse still needs reports and human moderation. There is no blanket claim that software can recognize every threat or private detail. Read failures preserve the static page and show an honest retry state; failed submissions preserve drafts. Free-tier limits can temporarily make community actions unavailable without removing stored discussions. No paid plan or DNS change is part of this feature.

Official implementation references: [Pages Functions configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/), [D1 bindings](https://developers.cloudflare.com/pages/functions/bindings/#d1-databases), [D1 limits and recovery window](https://developers.cloudflare.com/d1/platform/limits/).
