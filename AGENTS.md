# Fleet in Pieces website

The production target is Cloudflare Pages with GitHub integration. `site/` is the complete public output. Keep HTML/CSS/minimal vanilla JS, no build step or runtime backend. Do not introduce framework/npm/font-CDN/analytics dependencies without a new user instruction.

Read README.md for publication state and exact settings. This repo is separate from the older private Sites prototype in `../FleetInPieces`; do not publish this project through Sites or copy its `.openai` identity into this repository.

Ryan purchased fleetinpieces.space through Porkbun. **Do not touch Porkbun, DNS, nameservers, domain associations, billing, subscriptions or paid services until explicitly authorized.** The domain is not connected. Existing auth may be used for a free GitHub/Pages deployment; never persist credentials. The previous GitHub credential failed with HTTP401, and Cloudflare auth was unavailable.

Keep the dark, restrained style and dim laser-line logo. Phone visitors matter: check the actual page at about390px after meaningful layout changes. Ryan requested browser visual checks for this site; do a small real-browser pass, not an elaborate internal test suite. Keep gameplay-frame judgments separate from website layout review.

All external destinations are in `site/config.js`. Blank Steam URL must remain an honest coming-soon state; do not invent a Steam app ID, email, release date or feature promise. The static TikTok link is the documented no-JS fallback. Unknown socials stay hidden.

See ASSET_CHECKLIST.md and MEDIA_SOURCES.md before replacing clips. Use authentic silent gameplay and preserve native aspect ratios. No new game/editor launch or filming is authorized by this website task. Do not package the game source, saved credentials, QA browser profile or full source recordings with the site.
