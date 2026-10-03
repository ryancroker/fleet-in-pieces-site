# Fleet in Pieces website

The production target is Cloudflare Pages with GitHub integration. `site/` is the complete public output. Keep HTML/CSS/minimal vanilla JS, no build step or runtime backend. Do not introduce framework/npm/font-CDN/analytics dependencies without a new user instruction.

Read README.md for publication state and exact settings. This repo is separate from the older private Sites prototype in `../FleetInPieces`; do not publish this project through Sites or copy its `.openai` identity into this repository.

**CUSTOM DOMAIN LIVE - October 2, 2026.** https://fleetinpieces.space/ and https://www.fleetinpieces.space/ are active on the existing Cloudflare Pages project `fleet-in-pieces-site`, fed by https://github.com/ryancroker/fleet-in-pieces-site `main`. Keep framework None, blank build, output `site`. Ryan completed domain setup himself. Do not repeat the old DNS setup instructions, change hosting infrastructure, or alter account settings for visual edits.

Ryan approved the second transparent logo edit and requested a larger centered desktop masthead. Use `site/assets/logo/fleet-in-pieces-transparent.webp` (1348x240, RGBA, 33738 bytes); do not revert to the opaque original. Above 1150px it is centered at up to820px above the two hero columns; phone/tablet use the compact inline version. Both references share the same asset. Hero gradient is #05080c through #081018, with a restrained64px red divider. Keep the pale-blue CTA and dim logo filter. Hero source and390/1440px browser evidence live in `../../Saved/SourceChanges/FleetWebsiteHero_20261002`. No DNS/hosting changes are authorized by this visual pass.

Keep the dark, restrained style and dim laser-line logo. Phone visitors matter: check the actual page at about390px after meaningful layout changes. Ryan requested browser visual checks for this site; do a small real-browser pass, not an elaborate internal test suite. Keep gameplay-frame judgments separate from website layout review.

All external destinations are in `site/config.js`. Blank Steam URL must remain an honest coming-soon state; do not invent a Steam app ID, email, release date or feature promise. The static TikTok link is the documented no-JS fallback. Unknown socials stay hidden.

See ASSET_CHECKLIST.md and MEDIA_SOURCES.md before replacing clips. Use authentic silent gameplay and preserve native aspect ratios. No new game/editor launch or filming is authorized by this website task. Do not package the game source, saved credentials, QA browser profile or full source recordings with the site.
