# oriz-pdf

**Live: https://pdf.oriz.in**

Blueprint-style PDF toolkit that runs entirely in your browser. Merge, split, rotate, reorder, extract pages/text/images, and turn images into a PDF — on a graph-paper drafting table.

**100% client-side. No upload. No signup.** Your files never leave your device; all work happens in the browser via `pdf-lib` and `pdfjs-dist` (lazy-loaded only when you use a feature).

## Features

- **Assemble** — drop multiple PDFs, drag page cards to reorder across files, rotate per page, delete pages, then export one merged PDF. The signature page-assembly strip is your live draft.
- **Split** — one PDF per N pages, downloaded as a batch.
- **Extract text** — text per page; download as `.txt`; optional AI summary + AI filename suggestion.
- **Extract images** — pull embedded raster images out as PNG.
- **Images → PDF** — drop PNG/JPG, get a page-per-image PDF.

AI is optional polish (via `@chirag127/oz-ai`, g4f multi-provider failover, no key). If every provider is down, the core tools still work.

## Stack

Astro (static) · React 19 islands · Tailwind v4 · `pdf-lib` · `pdfjs-dist` · shared `@chirag127/oz-*` packages.

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
