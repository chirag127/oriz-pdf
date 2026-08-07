# oriz-pdf

**Live app:** https://pdf.oriz.in
**About / info:** https://chirag127.github.io/oriz-pdf/
**llms.txt:** https://pdf.oriz.in/llms.txt

Free PDF toolkit that runs entirely in your browser. Merge, split, rotate, reorder, extract pages/text/images, and turn images into a PDF — on a blueprint-style drafting table.

**100% client-side. No upload. No signup. Free.** Your files never leave your device; all work happens in-browser via `pdf-lib` and `pdfjs-dist` (lazy-loaded only when you use a feature).

## Features

- **Merge + reorder** — drop multiple PDFs, drag page cards to reorder across files, then export one merged PDF.
- **Split** — one PDF per N pages, downloaded as a batch.
- **Rotate** — per-page rotate, baked into the output.
- **Extract pages** — delete or keep any pages; the strip is your selection.
- **Extract text** — text per page as `.txt`; optional AI summary + filename suggestion.
- **Extract images** — pull embedded raster images out as PNG.
- **Images → PDF** — drop PNG/JPG, get a page-per-image PDF.

AI is optional polish (via `@chirag127/oz-ai`, g4f multi-provider failover, no key). If every provider is down, the core tools still work.

## Tech

Astro (static) · React 19 islands · Tailwind v4 · `pdf-lib` · `pdfjs-dist` · shared `@chirag127/oz-*` packages · PWA-installable · deployed on Cloudflare Pages.

## Develop

```bash
npm install --legacy-peer-deps
npm run dev      # local dev
npm test         # vitest — pure logic
npm run build    # static build → dist/
```

Windows note: use **npm** (pnpm skips `@esbuild/win32-x64` and the build crashes).

## License

MIT © 2026 Chirag Singhal
