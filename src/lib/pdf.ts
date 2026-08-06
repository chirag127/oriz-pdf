/**
 * pdf.ts — client-side PDF operations. pdf-lib is dynamically imported inside
 * each fn so nothing heavy lands in the initial bundle. All work is in-browser.
 */
import type { PDFDocument as PDFDoc } from 'pdf-lib'

export type Bytes = Uint8Array | ArrayBuffer

async function lib() {
  return import('pdf-lib')
}

function toU8(b: Bytes): Uint8Array {
  return b instanceof Uint8Array ? b : new Uint8Array(b)
}

/** Parse a page-range spec ("1-3,5,8-") into 0-based indices within [0,count). */
export function parsePageRanges(spec: string, count: number): number[] {
  const out: number[] = []
  const seen = new Set<number>()
  for (const raw of spec.split(',')) {
    const part = raw.trim()
    if (!part) continue
    const m = part.match(/^(\d+)?\s*-\s*(\d+)?$/)
    if (m) {
      const start = m[1] ? Number(m[1]) : 1
      const end = m[2] ? Number(m[2]) : count
      const lo = Math.min(start, end)
      const hi = Math.max(start, end)
      for (let p = lo; p <= hi; p++) {
        const i = p - 1
        if (i >= 0 && i < count && !seen.has(i)) {
          seen.add(i)
          out.push(i)
        }
      }
    } else {
      const p = Number(part)
      if (Number.isInteger(p)) {
        const i = p - 1
        if (i >= 0 && i < count && !seen.has(i)) {
          seen.add(i)
          out.push(i)
        }
      }
    }
  }
  return out
}

/** Number of pages in a PDF. */
export async function pageCount(bytes: Bytes): Promise<number> {
  const { PDFDocument } = await lib()
  const doc = await PDFDocument.load(toU8(bytes), { ignoreEncryption: true })
  return doc.getPageCount()
}

/** Merge many PDFs (in order) into one. */
export async function mergePdfs(files: Bytes[]): Promise<Uint8Array> {
  const { PDFDocument } = await lib()
  const out = await PDFDocument.create()
  for (const f of files) {
    const src = await PDFDocument.load(toU8(f), { ignoreEncryption: true })
    const pages = await out.copyPages(src, src.getPageIndices())
    for (const p of pages) out.addPage(p)
  }
  return out.save()
}

/** Build a new PDF from selected 0-based page indices, in the given order. */
export async function extractPages(
  bytes: Bytes,
  indices: number[],
): Promise<Uint8Array> {
  const { PDFDocument } = await lib()
  const src = await PDFDocument.load(toU8(bytes), { ignoreEncryption: true })
  const out = await PDFDocument.create()
  const valid = indices.filter((i) => i >= 0 && i < src.getPageCount())
  const pages = await out.copyPages(src, valid)
  for (const p of pages) out.addPage(p)
  return out.save()
}

/**
 * Split a PDF into one document per chunk of `size` pages.
 * size=1 → one PDF per page.
 */
export async function splitBySize(
  bytes: Bytes,
  size: number,
): Promise<Uint8Array[]> {
  const { PDFDocument } = await lib()
  const src = await PDFDocument.load(toU8(bytes), { ignoreEncryption: true })
  const total = src.getPageCount()
  const step = Math.max(1, Math.floor(size))
  const parts: Uint8Array[] = []
  for (let start = 0; start < total; start += step) {
    const idx: number[] = []
    for (let i = start; i < Math.min(start + step, total); i++) idx.push(i)
    const out = await PDFDocument.create()
    const pages = await out.copyPages(src, idx)
    for (const p of pages) out.addPage(p)
    parts.push(await out.save())
  }
  return parts
}

/** Reorder pages to exactly the given 0-based order (must be a permutation-ish list). */
export async function reorderPages(
  bytes: Bytes,
  order: number[],
): Promise<Uint8Array> {
  return extractPages(bytes, order)
}

/** Rotate given pages (0-based) by degrees (multiple of 90). Empty list → all. */
export async function rotatePages(
  bytes: Bytes,
  deg: number,
  indices?: number[],
): Promise<Uint8Array> {
  const { PDFDocument, degrees } = await lib()
  const doc = await PDFDocument.load(toU8(bytes), { ignoreEncryption: true })
  const pages = doc.getPages()
  const targets =
    indices && indices.length ? indices : pages.map((_, i) => i)
  const norm = ((Math.round(deg / 90) * 90) % 360 + 360) % 360
  for (const i of targets) {
    const pg = pages[i]
    if (!pg) continue
    const cur = pg.getRotation().angle
    pg.setRotation(degrees((cur + norm) % 360))
  }
  return doc.save()
}

/** Delete given 0-based pages, keep the rest in order. */
export async function deletePages(
  bytes: Bytes,
  remove: number[],
): Promise<Uint8Array> {
  const { PDFDocument } = await lib()
  const src = await PDFDocument.load(toU8(bytes), { ignoreEncryption: true })
  const removeSet = new Set(remove)
  const keep = src
    .getPageIndices()
    .filter((i) => !removeSet.has(i))
  return extractPages(bytes, keep)
}

/** Image (png/jpg) bytes → single-page PDF sized to the image. */
export async function imagesToPdf(
  images: { bytes: Bytes; type: string }[],
): Promise<Uint8Array> {
  const { PDFDocument } = await lib()
  const out = await PDFDocument.create()
  for (const img of images) {
    const u8 = toU8(img.bytes)
    const embedded = /png/i.test(img.type)
      ? await out.embedPng(u8)
      : await out.embedJpg(u8)
    const page = out.addPage([embedded.width, embedded.height])
    page.drawImage(embedded, {
      x: 0,
      y: 0,
      width: embedded.width,
      height: embedded.height,
    })
  }
  return out.save()
}

/** Load a PDFDocument (helper for callers that need multiple ops). */
export async function load(bytes: Bytes): Promise<PDFDoc> {
  const { PDFDocument } = await lib()
  return PDFDocument.load(toU8(bytes), { ignoreEncryption: true })
}
