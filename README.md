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
| Environment variables | None |

Cloudflare's Git integration guide explicitly allows a blank command for a site without a build. The Pages site is verified. The Free custom-domain zone is active and both domain associations exist; the remaining DNS record edits are awaiting Ryan in the dashboard. No paid feature is required.

Official references: [Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/), [build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/), [custom headers](https://developers.cloudflare.com/pages/configuration/headers/).

## PAGES LIVE; CUSTOM DOMAIN PENDING — October 2, 2026

Live at **[fleet-in-pieces-site.pages.dev](https://fleet-in-pieces-site.pages.dev/)** from the public repository **[ryancroker/fleet-in-pieces-site](https://github.com/ryancroker/fleet-in-pieces-site)**. Git-backed production deployment `cf9447e2-7a97-4501-8772-bad7372aeb93` succeeded from `main` commit `2a2bc509c8bf213f561e08b374755b32d74e2551`. GitHub and Cloudflare authentication/integration work. Reuse this repository and Pages project; do not force-push.

Live Chrome review at 390×844 and 1440×1000 found no overflow, home-page errors or failed requests. Videos play; the phone hero starts paused and desktop autoplay works. All 24 public assets match local hashes. HTTPS is valid, the Pages address has `noindex`, metadata resources return 200, and the custom 404 works. Python urllib received Cloudflare error 1010; the successful verification used Chrome. JSON receipts/screenshots: `../../Saved/SourceChanges/FleetWebsiteDeployment_20261002`.

**Nameservers are changed; custom-domain DNS records are still pending.** Ryan completed the Porkbun change himself. Registry RDAP confirms `eva.ns.cloudflare.com` and `kurt.ns.cloudflare.com`; Free zone `5f8a0986440847178750fab9fc7a0b28` is **ACTIVE**. Both `fleetinpieces.space` and `www.fleetinpieces.space` are attached to Pages but remain pending with **“CNAME record not set”**. Wrangler DNS API access returned 403 (`pages:write` / `zone:read` only), so the assistant has made no DNS record edits. Ryan has the dashboard instructions below; completion is not yet confirmed. Custom-domain HTTPS is not verified. Do not put credentials in this repository or chat.

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

- `site/` is the complete deployable output, about **2.70 MiB** including all five videos.
- `index.html`, `styles.css`, `script.js`, `config.js` define the page.
- `404.html` is the actual missing-page response on Pages; it prevents accidental SPA-style fallback.
- `robots.txt` and `sitemap.xml` name the canonical root; the sitemap contains only the real home page.
- `site.webmanifest`, SVG favicon and PNG icons are included. This is a website, not an offline app; no service worker is installed.
- `_headers` supplies a self-only CSP, frame protection, MIME protection, referrer policy and restricted unused browser permissions. It also prevents indexing temporary Pages hostnames.
- CSS/JavaScript revalidate on every visit. Stable media filenames cache for one hour, without `immutable`. If replacing a media file immediately after launch, rename/version it and update its references to avoid stale browser copies.

## Review

See **[QUALITY_REVIEW.md](QUALITY_REVIEW.md)** for the completed browser checks and their limits. The local review uses the machine's existing headless Chrome and existing tooling outside this repository; no npm dependency is part of the site.

## Remaining custom-domain DNS work

Ryan has the following dashboard instructions. The nameserver change is complete; the record edits remain unconfirmed:

| Item | Last confirmed / imported value | Required dashboard change |
| --- | --- | --- |
| Authoritative nameservers | `eva.ns.cloudflare.com`, `kurt.ns.cloudflare.com` | Complete; no further change |
| Apex `@` | A `207.207.210.229` and A `207.207.210.107` | Replace both with proxied CNAME `fleet-in-pieces-site.pages.dev`, Auto TTL |
| `www` | CNAME `pixie.porkbun.com` | Change target to `fleet-in-pieces-site.pages.dev`, Auto TTL |
| Wildcard `*` | CNAME `pixie.porkbun.com` | Remove the parking record |

After Ryan confirms these record edits, verify both Pages custom-domain statuses and TLS certificates become active. Then check `https://fleetinpieces.space/`, `https://www.fleetinpieces.space/`, assets, a missing route and mobile media before calling either custom domain live.

This follows [Cloudflare's custom-domain instructions](https://developers.cloudflare.com/pages/configuration/custom-domains/). Nameserver activation alone does not establish working site records or HTTPS.
