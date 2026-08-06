/**
 * render.ts — pdfjs-dist wrapper for thumbnails + text extraction. Lazy-loaded.
 * pdfjs is heavy; import() only fires when a feature needs it.
 */
export interface PageThumb {
  index: number
  dataUrl: string
  width: number
  height: number
}

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null

async function pdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const mod = await import('pdfjs-dist')
      // Worker as a module URL — Vite bundles it, no CDN, fully offline.
      const workerUrl = (
        await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
      ).default
      mod.GlobalWorkerOptions.workerSrc = workerUrl
      return mod
    })()
  }
  return pdfjsPromise
}

async function getDoc(bytes: Uint8Array) {
  const mod = await pdfjs()
  // Copy — pdfjs transfers/neuters the buffer it's given.
  const data = bytes.slice(0)
  return mod.getDocument({ data }).promise
}

/** Render every page to a small thumbnail data URL. */
export async function renderThumbnails(
  bytes: Uint8Array,
  scale = 0.35,
  onProgress?: (done: number, total: number) => void,
): Promise<PageThumb[]> {
  const doc = await getDoc(bytes)
  const out: PageThumb[] = []
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas 2d unavailable')
    await page.render({ canvas, canvasContext: ctx, viewport }).promise
    out.push({
      index: n - 1,
      dataUrl: canvas.toDataURL('image/png'),
      width: canvas.width,
      height: canvas.height,
    })
    onProgress?.(n, doc.numPages)
  }
  return out
}

/** Extract all text, page by page. */
export async function extractText(
  bytes: Uint8Array,
  onProgress?: (done: number, total: number) => void,
): Promise<{ page: number; text: string }[]> {
  const doc = await getDoc(bytes)
  const out: { page: number; text: string }[] = []
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n)
    const content = await page.getTextContent()
    const text = content.items
      .map((it) => ('str' in it ? it.str : ''))
      .join(' ')
      .replace(/\s+\n/g, '\n')
      .trim()
    out.push({ page: n, text })
    onProgress?.(n, doc.numPages)
  }
  return out
}

/** Extract embedded raster images from a PDF as PNG data URLs. */
export async function extractImages(
  bytes: Uint8Array,
  onProgress?: (done: number, total: number) => void,
): Promise<{ page: number; dataUrl: string }[]> {
  const doc = await getDoc(bytes)
  const out: { page: number; dataUrl: string }[] = []
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n)
    const ops = await page.getOperatorList()
    const mod = await pdfjs()
    const OPS = mod.OPS
    for (let i = 0; i < ops.fnArray.length; i++) {
      const fn = ops.fnArray[i]
      if (fn !== OPS.paintImageXObject && fn !== OPS.paintInlineImageXObject)
        continue
      const name = ops.argsArray[i]?.[0]
      if (typeof name !== 'string') continue
      try {
        const img = await new Promise<{
          width: number
          height: number
          data?: Uint8ClampedArray | Uint8Array
          bitmap?: ImageBitmap
        }>((resolve, reject) => {
          page.objs.get(name, (x: unknown) => {
            if (x) resolve(x as never)
            else reject(new Error('no image'))
          })
        })
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        if (!ctx) continue
        if (img.bitmap) {
          ctx.drawImage(img.bitmap, 0, 0)
        } else if (img.data) {
          // pdfjs raw data can be RGB (3ch) or RGBA (4ch); normalize to RGBA.
          const px = img.width * img.height
          const rgba = new Uint8ClampedArray(px * 4)
          const ch = img.data.length / px
          for (let p = 0; p < px; p++) {
            if (ch === 4) {
              rgba[p * 4] = img.data[p * 4]
              rgba[p * 4 + 1] = img.data[p * 4 + 1]
              rgba[p * 4 + 2] = img.data[p * 4 + 2]
              rgba[p * 4 + 3] = img.data[p * 4 + 3]
            } else if (ch === 3) {
              rgba[p * 4] = img.data[p * 3]
              rgba[p * 4 + 1] = img.data[p * 3 + 1]
              rgba[p * 4 + 2] = img.data[p * 3 + 2]
              rgba[p * 4 + 3] = 255
            } else {
              const g = img.data[p * ch]
              rgba[p * 4] = g
              rgba[p * 4 + 1] = g
              rgba[p * 4 + 2] = g
              rgba[p * 4 + 3] = 255
            }
          }
          ctx.putImageData(new ImageData(rgba, img.width, img.height), 0, 0)
        } else {
          continue
        }
        out.push({ page: n, dataUrl: canvas.toDataURL('image/png') })
      } catch {
        // image obj not ready / unsupported — skip
      }
    }
    onProgress?.(n, doc.numPages)
  }
  return out
}
