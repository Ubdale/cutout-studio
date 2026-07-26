# Cutout Studio

Free, browser-based image tools built with Next.js. First tool: **background remover**.
All processing runs client-side (via `@imgly/background-removal` + WASM), so there is
**no server compute cost** — your hosting only serves static pages.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000 — the tool is at `/remove-background`.

## Build & deploy

```bash
npm run build
npm start
```

Both routes prerender as **static** pages, so it deploys free on Vercel/Netlify/Cloudflare
Pages. Just connect the repo and deploy — no env vars needed.

## How the zero-cost model works

- The background-removal model is a WASM/ONNX bundle that the user's browser downloads
  **once** (cached afterwards) from imgly's CDN, then runs locally.
- Nothing is uploaded to your server. This is also the privacy selling point.
- Because there is no per-request compute, you can offer it free/unlimited and monetise
  with ads or a small "pro" tier later.

## Roadmap (SEO plan)

Each tool = its own route = its own keyword page:

- `/remove-background` — live
- `/compress-image` — planned (client-side canvas/WASM)
- `/convert-image` — planned (PNG ⇄ JPG ⇄ WebP)
- `/resize-image`, `/favicon-generator` — planned

Add a `sitemap.ts` and `robots.ts` before launch, and submit to Google Search Console.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- `@imgly/background-removal` for the cutout
- No database, no API, no server state.
