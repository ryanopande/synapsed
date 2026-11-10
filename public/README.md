# `public/` — Static assets

Files served as-is by Next.js from `/`.

Hub: [`../README.md`](../README.md).

---

## Contents

| Asset | Notes |
|---|---|
| `logo.png`, `logo_blue.png` | Primary brand marks used in UI / landing |
| `logo_old.svg` | Legacy logo |
| `file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg` | Default / decorative SVGs |

Prefer referencing logos via `/logo.png` (etc.) from components. Do not put secrets or generated user content here — uploads go to Cloudflare R2 (`lib/r2`).
