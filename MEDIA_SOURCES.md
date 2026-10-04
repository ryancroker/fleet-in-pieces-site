# Media provenance

The assets below derive from existing Fleet in Pieces creator media in the PixelSimShips workspace. These paths describe the source library; only the compact derivatives in `site/` are published. Source recordings, credentials, private logs and the game repository are not included.

| Website asset | Existing source relative to `Saved/DevDiary/` | Source interval / operation |
| --- | --- | --- |
| Hero | `living-war-20260930/source/aec53c79a9f02360.mkv` | 14.253585–38.253585 seconds, 2×; original captured at half simulation speed |
| Damage | Same Living War source | 28.62–38.38 seconds, 2× |
| Carrier | `carrier-command-20260923/source/fe684eca9c618851.mkv` | 34.4–49.0 seconds, ordinary pace |
| Jump rescue | `hero-rescue-20260923/production/cut-v3/hero-v3-original-paced.mp4` | 47.5–59.5 seconds from the pre-caption, already-paced export |
| Planet | `consequences-v2-20260927/source/5a30277a08147031.mkv` | 176.677726–197.154507 seconds, 2×; labeled on page |
| Logo / social card | `hero-rescue-20260923/source/8c15141dba47496d.png` | Supplied laser-line artwork, cropped/resized and WebP compressed |

The rescue event mapping places the jump around 53.954 seconds in the paced export. The selected website clip includes the charge/jump phase and stops before the separately filmed HAVEN arrival pickup; it does not imply an uninterrupted arrival shot. Copy describes jump extraction, not towing.

All clips are silent H.264 in MP4 containers with faststart. No editorial caption/music layer is copied. Posters come from the corresponding clips. The carrier recording retains native interface elements. No new game filming occurred. Web-page composition was visually inspected because Ryan explicitly requested it; this was not a fresh acceptance pass on the game's features or a new editorial review of every video frame.

The newest Laser Hunters footage was deliberately not used to demonstrate exact component targeting: the project guide records Ryan's October 2 report of hull-center targeting. No unsupported precision-targeting claim is made by this page.

## Transparent hero logo - October 2, 2026

The original `fleet-in-pieces.webp` is RGB with a baked-in dark background. Ryan approved the second built-in image editor result after reviewing both versions. Its prompt requested background removal only: preserve the two lettering rows, narrow red line, crosshair and relative proportions; remove backdrop/haze and avoid added glow, bevels or shadows. The final `fleet-in-pieces-transparent.webp` uses that approved artwork, cropped only to remove excess transparent canvas, scaled to1348x240, then lossless WebP encoded with real alpha (33738 bytes). The original and approved PNG, method receipt and before/after browser captures are archived outside the public site in `Saved/SourceChanges/FleetWebsiteHero_20261002`. The first generated variant was rejected and is not deployed. The social card remains a deliberately full-background image.

## Missile system page - October 3, 2026

`site/assets/video/missile-range.mp4` uses seconds27-39 of the existing `Saved/DevDiary/guardian-missile-challenge-20260920/source/93c6205b5340825d.mkv`, at unchanged speed. This is one continuous archived Missile Range encounter, not current-build acceptance or evidence of a community suggestion being implemented. Its source identity and original recording are in that episode's `assets.json`; `production/pace-v10/retime-plan.json` and `timing-proof.json` retain the selected encounter and event mapping. Recorded point-defense interceptions surround the first missile hull hit at source31.899seconds. The site's other combat footage is not substituted for missile gameplay.

The derivative is silent H.264,576x1024,30fps,12seconds/360frames,CRF25,faststart,129621bytes. `site/assets/images/missile-range-poster.webp` comes from source30.1seconds,576x1024,WebP quality82,4700bytes. SHA256: video `cedce63211a689252230fbf07c1a135ca876565101eee51cd0b477d3f8e47d8b`; poster `8ae8cde163bc3a804f2b4557e9627a4c10d90fd1b83fbae127d6e996d2879fb4`. Dimensions, duration, frame rate, absent audio and full video decode were checked. No new capture or model gameplay-frame review; Ryan retains visual acceptance. Only these compact derivatives belong in the public output.

## First-deployment shirt mockup — October 3, 2026

`site/assets/images/first-deployment-shirt.jpg` is the actual public Fourthwall product mockup (1536×2048,107725bytes), downloaded from the product's structured image metadata. It shows the black shirt with **VESSEL: KESTRAL / OPERATIONAL STATUS: DEGRADED**. The original JPEG is retained without artwork edits or generated replacement. Exact product and image source URLs are recorded in `content/merch.json`. Public structured offers confirmed Black, XS–5XL, starting at US$21 (larger sizes cost more); recheck those metadata when the product changes. Checkout remains authoritative for current variant pricing, tax and shipping.

New ship/system pages reuse the existing clips above without new filming. The planet clip remains labeled2×; the rescue clip describes extraction and does not claim an arrival sequence. The development log is editorial project status, not new footage or gameplay acceptance.
