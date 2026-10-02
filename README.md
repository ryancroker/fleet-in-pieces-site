# Fleet in Pieces

Production static website for **https://fleetinpieces.space**. HTML, CSS and a small vanilla JavaScript enhancement. No framework, package manager, build step, external fonts, analytics, database, backend, cookies or signup form.

## Preview locally

With Python 3 already installed:

```powershell
python preview.py
```

Open **http://127.0.0.1:4173/**. Stop with Ctrl+C. The optional preview server reproduces the custom 404 and path-based security headers. It is a development convenience outside `site/`; Cloudflare serves only static files.

## Cloudflare Pages settings

Connect the GitHub repository using **Pages → Import an existing Git repository**. Use a Git-integrated Pages project, not Workers or Direct Upload.

| Setting | Value |
| --- | --- |
| Project name | `fleet-in-pieces-site` (or the available name Cloudflare accepts) |
| Production branch | `main` |
| Framework preset | `None` |
| Build command | **Leave blank** — no build |
| Build output directory | `site` |
| Root directory | Leave blank / repository root |
| Environment variables | None |

Cloudflare's Git integration guide explicitly allows a blank command for a site without a build. If a dashboard variant insists on a command, use `exit 0`, never the literal word `none`. Deploy to the assigned `*.pages.dev` address first. Do not connect the purchased domain until Ryan explicitly confirms Porkbun is ready. No paid feature is required.

Official references: [Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/), [build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/), [custom headers](https://developers.cloudflare.com/pages/configuration/headers/).

## Current publication state — October 2, 2026

The local site is complete and reviewed. Git's credential manager lists the `ryancroker` GitHub account, but its saved credential was rejected by GitHub's API with HTTP 401. GitHub CLI is not installed. No working Cloudflare API credential or local Wrangler login was available; the app's browser-control runtime also failed to initialize. Therefore **no GitHub repository or Cloudflare project/deployment was created in this pass**. No DNS, Porkbun, nameservers, domain association, billing or subscription changes were made.

To restore the existing GitHub account, run:

```powershell
git credential-manager github login --username ryancroker --browser --force
```

Complete GitHub's own browser sign-in. Do not paste passwords/tokens into this repository or chat. Once signed in, the prepared local repository can be published without changing any files. If continuing manually:

1. At [GitHub's new repository page](https://github.com/new), create **fleet-in-pieces-site**, Public, without initializing a README, license or gitignore (the local repository already has its initial commit).
2. From this repository directory:

```powershell
git remote add origin https://github.com/ryancroker/fleet-in-pieces-site.git
git push -u origin main
```

3. In Cloudflare: **Workers & Pages → Create application → Pages → Import an existing Git repository**. Authorize access to this repository, select it, enter the settings above and deploy. Keep the free setup. If a paid upgrade is requested, stop; it is not needed for this site.

If a remote or repository already exists by then, reuse it after checking its contents; do not overwrite or force-push it. See [GitHub's existing-code guide](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github).

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

## Domain steps — only after Porkbun is ready and Ryan authorizes them

Nothing in this section has been performed.

1. First confirm the Git-connected `*.pages.dev` deployment works.
2. To use the apex **fleetinpieces.space**, add that domain as a zone in the same Cloudflare account, using the Free option. Preserve any existing DNS records that need to survive.
3. In Pages → `fleet-in-pieces-site` → **Custom domains → Set up a domain**, enter `fleetinpieces.space` and follow the setup.
4. At Porkbun, replace the domain's authoritative nameservers with the **two exact nameservers Cloudflare assigns that zone**. Do not use guessed/example nameservers. An apex Pages domain requires the Cloudflare zone; a generic CNAME at Porkbun is not a substitute for this step.
5. Let the zone become active. Pages creates/validates its DNS association. Wait for both the custom-domain status and TLS certificate to become active, then check `https://fleetinpieces.space/`, assets, `/404.html`, a missing route and the TikTok link on a phone.
6. Once the final address works, use it in the TikTok bio. Connecting Steam later remains a one-value config edit.

This follows [Cloudflare's apex-domain instructions](https://developers.cloudflare.com/pages/configuration/custom-domains/). The exact nameservers and `pages.dev` hostname cannot be known until the actual Cloudflare project/zone exists.
