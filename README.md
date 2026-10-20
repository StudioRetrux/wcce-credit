# Retrux × WCCE 2026 – landing page

The page behind the installation QR (link.retrux.com/retruxwcce): the idea, the two acts, a playable pocket
version of the installation, the two spots (Kempinski, SCBD), credits and Retrux socials.

Plain static site: one `index.html` plus `assets/` (fonts, images, and vendored three.js and Lenis, so nothing loads
from a CDN). No build step.

## Run

```bash
npx serve -l 4180    # http://localhost:4180
```

## Layout

```
index.html                 the whole page: markup, styles, scroll reveals
assets/js/hero-fan.js      hero: the ring of violet plates (three.js)
assets/js/glass-stacks.js  "Your turn": the installation's blades, follows cursor or finger
assets/js/lenis.min.js     smooth scroll (wheel and trackpad only)
assets/fonts/              Space Grotesk, self-hosted latin subset
assets/img/                stills, pillar art, venue photos, logos
```

Still to confirm: venue and dates for both spots (marked "to be confirmed" on the page).

## Deploy

Static, so any host works. On Vercel: framework preset "Other", no build command, output directory = root.
