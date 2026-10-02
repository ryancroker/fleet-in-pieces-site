# Asset checklist

**No required assets are missing.** All current references resolve to real local files. Existing footage is actual in-development gameplay, silently encoded from local originals. It may show native interface elements, particularly the carrier clip; an interface-free carrier capture is a recommended marketing upgrade, not a broken placeholder.

| Included file under `site/` | Current specification | Replacement target |
| --- | --- | --- |
| `assets/logo/fleet-in-pieces.webp` | 1348×240, about 9 KB | Same aspect; supplied logo, sharp lettering, ≤75 KB |
| `assets/video/hero-loop.mp4` | 720×1280, 12 s, about 0.87 MiB | Portrait 9:16; 10–15 s, silent H.264, ≤2 MiB |
| `assets/video/damage-demo.mp4` | 576×1024, 4.88 s, about 0.24 MiB | 9:16; readable component/hull damage, 6–12 s, ≤1.5 MiB |
| `assets/video/carrier-wing.mp4` | 576×1024, 14.6 s, about 0.43 MiB | 9:16; interface-free fighter launch/recovery, 10–15 s, ≤1.5 MiB |
| `assets/video/jump-rescue.mp4` | 576×1024, 12 s, about 0.58 MiB | 9:16; attachment/charge/extraction, 10–15 s, ≤1.5 MiB |
| `assets/video/planet-killer.mp4` | 576×1024, about 10.24 s, about 0.45 MiB | 9:16; rupture/siege action, 8–15 s, ≤1.5 MiB |
| `assets/images/hero-loop-poster.webp` | 720×1280 | Same aspect; ≤100 KB |
| `assets/images/damage-demo-poster.webp` | 576×1024 | Same aspect; ≤80 KB |
| `assets/images/carrier-wing-poster.webp` | 576×1024 | Same aspect; ≤80 KB |
| `assets/images/jump-rescue-poster.webp` | 576×1024 | Same aspect; ≤80 KB |
| `assets/images/planet-killer-poster.webp` | 576×1024 | Same aspect; ≤80 KB |
| `assets/images/social-card.webp` | 1200×630, about 9 KB | Same 1.91:1 aspect; title readable; ≤200 KB |
| `assets/icons/favicon.svg` | Small vector F/fragment mark | Keep recognizable at 16/32 px |
| `assets/icons/icon-180.png`, `icon-192.png`, `icon-512.png` | PNG app/bookmark icons | Matching square dimensions |

## Optional future landscape hero

These files are **not present and are not requested by the page** while the two config entries stay blank:

- `assets/video/hero-loop-wide.mp4`: 1920×1080 or 1280×720; 16:9; 10–15 seconds; silent H.264/yuv420p/faststart, ideally ≤3 MiB. Compose key action toward the center/right so the left headline has breathing room. No TikTok captions, watermark, copyrighted music or debugging overlays.
- `assets/images/hero-loop-wide-poster.webp`: matching 16:9 frame, 1280×720 preferred, ≤150 KB.

Drop the pair in those paths and set `HERO_WIDE_VIDEO` and `HERO_WIDE_POSTER` in `site/config.js`. The hero becomes a full-area background, with contrast protection behind text. Keep the included portrait hero as the fallback. Review the new crop on a 390px phone before release.

## Replacement notes

Keep existing names, aspect ratios and codecs for drop-in replacements. Preserve muted/no-audio delivery. Replacing a file with a different aspect ratio also requires updating its width/height and presentation rule. The existing planet excerpt is labeled **2×**: change that label if replacing it with normal-speed footage. The hero/damage source was recorded at half simulation speed and restored to normal simulation pace.

If an SVG version of the authentic logo becomes available, it can replace the WebP after the HTML reference is updated; it is not required now. Never substitute generated ships or effects for actual gameplay.
