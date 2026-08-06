import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { downloadBlob, formatBytes } from '@chirag127/oz-file'
import {
  deletePages,
  extractPages,
  imagesToPdf,
  mergePdfs,
  reorderPages,
  rotatePages,
  splitBySize,
} from '../lib/pdf'
import type { PageThumb } from '../lib/render'
import { moveItem, slugFilename } from '../lib/util'

type Tool =
  | 'assemble'
  | 'split'
  | 'extract-text'
  | 'extract-images'
  | 'images-to-pdf'

interface LoadedFile {
  id: string
  name: string
  bytes: Uint8Array
  size: number
}

interface PageCard {
  key: string
  fileId: string
  index: number // 0-based page index within its source file
  rotation: number
  thumb?: PageThumb
}

const uid = () => Math.random().toString(36).slice(2, 9)

const TOOLS: { id: Tool; label: string; hint: string }[] = [
  { id: 'assemble', label: 'Assemble', hint: 'merge · reorder · rotate · delete · extract' },
  { id: 'split', label: 'Split', hint: 'one PDF per N pages' },
  { id: 'extract-text', label: 'Extract text', hint: 'text per page + AI summary' },
  { id: 'extract-images', label: 'Extract images', hint: 'pull raster images out' },
  { id: 'images-to-pdf', label: 'Images → PDF', hint: 'png/jpg → one PDF' },
]

export default function Workbench() {
  const [tool, setTool] = useState<Tool>('assemble')

  return (
    <div className="wb">
      <nav className="wb__tabs" aria-label="Tools">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            className={`wb__tab${tool === t.id ? ' is-active' : ''}`}
            aria-current={tool === t.id}
            onClick={() => setTool(t.id)}
            type="button"
          >
            <span className="wb__tab-label">{t.label}</span>
            <span className="wb__tab-hint tick">{t.hint}</span>
          </button>
        ))}
      </nav>

      <section className="wb__stage">
        {tool === 'assemble' && <Assemble />}
        {tool === 'split' && <Split />}
        {tool === 'extract-text' && <ExtractText />}
        {tool === 'extract-images' && <ExtractImages />}
        {tool === 'images-to-pdf' && <ImagesToPdf />}
      </section>
    </div>
  )
}

/* ---------- shared bits ---------- */

function Dropzone({
  accept,
  multiple,
  label,
  onFiles,
}: {
  accept: string
  multiple: boolean
  label: string
  onFiles: (files: File[]) => void
}) {
  const [over, setOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div
      className={`dz${over ? ' is-over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const f = Array.from(e.dataTransfer.files)
        if (f.length) onFiles(multiple ? f : f.slice(0, 1))
      }}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
      }}
      role="button"
      tabIndex={0}
      aria-label={label}
    >
      <svg className="dz__mark" viewBox="0 0 48 48" aria-hidden="true">
        <rect x="8" y="4" width="26" height="40" rx="1" />
        <path d="M34 4v10h10" />
        <line x1="16" y1="24" x2="34" y2="24" />
        <line x1="16" y1="31" x2="30" y2="31" />
      </svg>
      <p className="dz__label">{label}</p>
      <p className="tick">drag + drop or click · stays on your device</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(e) => {
          const f = Array.from(e.target.files ?? [])
          if (f.length) onFiles(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}

function Progress({ label }: { label: string }) {
  return (
    <div className="prog" role="status" aria-live="polite">
      <span className="prog__bar" />
      <span className="tick">{label}</span>
    </div>
  )
}

function ErrorNote({ msg }: { msg: string }) {
  return (
    <p className="err" role="alert">
      ⚠ {msg}
    </p>
  )
}

async function fileToU8(f: File): Promise<Uint8Array> {
  return new Uint8Array(await f.arrayBuffer())
}

function saveBytes(bytes: Uint8Array, name: string) {
  // Copy into a fresh, standalone ArrayBuffer-backed view for Blob typing.
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  downloadBlob(new Blob([copy], { type: 'application/pdf' }), name)
}

/* ---------- ASSEMBLE: signature page-assembly strip ---------- */

function Assemble() {
  const [files, setFiles] = useState<LoadedFile[]>([])
  const [cards, setCards] = useState<PageCard[]>([])
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)

  const addFiles = useCallback(async (incoming: File[]) => {
    setErr('')
    setBusy('reading pages…')
    try {
      const { renderThumbnails } = await import('../lib/render')
      const { pageCount } = await import('../lib/pdf')
      const newFiles: LoadedFile[] = []
      const newCards: PageCard[] = []
      for (const f of incoming) {
        if (!/pdf$/i.test(f.type) && !/\.pdf$/i.test(f.name)) continue
        const bytes = await fileToU8(f)
        const id = uid()
        newFiles.push({ id, name: f.name, bytes, size: f.size })
        const count = await pageCount(bytes)
        const thumbs = await renderThumbnails(bytes, 0.4)
        for (let i = 0; i < count; i++) {
          newCards.push({
            key: uid(),
            fileId: id,
            index: i,
            rotation: 0,
            thumb: thumbs[i],
          })
        }
      }
      if (!newFiles.length) {
        setErr('No PDF files detected.')
        return
      }
      setFiles((p) => [...p, ...newFiles])
      setCards((p) => [...p, ...newCards])
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to read PDF.')
    } finally {
      setBusy('')
    }
  }, [])

  const bytesFor = useCallback(
    (fileId: string) => files.find((f) => f.id === fileId)?.bytes,
    [files],
  )

  const rotateCard = (key: string, delta: number) =>
    setCards((p) =>
      p.map((c) =>
        c.key === key ? { ...c, rotation: (c.rotation + delta + 360) % 360 } : c,
      ),
    )

  const removeCard = (key: string) =>
    setCards((p) => p.filter((c) => c.key !== key))

  const onDrop = (to: number) => {
    if (dragIdx === null) return
    setCards((p) => moveItem(p, dragIdx, to))
    setDragIdx(null)
    setOverIdx(null)
  }

  const assemble = useCallback(async () => {
    if (!cards.length) return
    setErr('')
    setBusy('assembling…')
    try {
      // Group is simplest when single source. For multi-source, build per-file
      // extracted docs then merge in card order — but preserve per-page rotation.
      // Strategy: for each card, extract its single page (rotated) then merge.
      const parts: Uint8Array[] = []
      for (const c of cards) {
        const src = bytesFor(c.fileId)
        if (!src) continue
        let one = await extractPages(src, [c.index])
        if (c.rotation) one = await rotatePages(one, c.rotation, [0])
        parts.push(one)
      }
      const out = await mergePdfs(parts)
      saveBytes(out, slugFilename('assembled', 'assembled'))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Assembly failed.')
    } finally {
      setBusy('')
    }
  }, [cards, bytesFor])

  const totalSize = files.reduce((s, f) => s + f.size, 0)

  return (
    <div className="assemble">
      <div className="assemble__intake">
        <Dropzone
          accept="application/pdf"
          multiple
          label="Drop PDFs to assemble"
          onFiles={addFiles}
        />
        {files.length > 0 && (
          <p className="tick assemble__meta">
            {files.length} file(s) · {cards.length} pages · {formatBytes(totalSize)}
          </p>
        )}
      </div>

      {busy && <Progress label={busy} />}
      {err && <ErrorNote msg={err} />}

      {cards.length > 0 && (
        <>
          <div className="strip__head">
            <span className="tick">page assembly · drag to reorder</span>
            <div className="strip__actions">
              <button
                className="btn"
                type="button"
                onClick={() => {
                  setCards([])
                  setFiles([])
                }}
              >
                Clear
              </button>
              <button
                className="btn btn--primary"
                type="button"
                onClick={assemble}
                disabled={!!busy}
              >
                Assemble → PDF
              </button>
            </div>
          </div>

          <ol className="strip" aria-label="Assembled pages">
            {cards.map((c, i) => (
              <li
                key={c.key}
                className={`pcard${overIdx === i ? ' is-drop' : ''}${dragIdx === i ? ' is-dragging' : ''}`}
                draggable
                onDragStart={() => setDragIdx(i)}
                onDragEnter={() => setOverIdx(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(i)}
                onDragEnd={() => {
                  setDragIdx(null)
                  setOverIdx(null)
                }}
              >
                <span className="pcard__no mono">{String(i + 1).padStart(2, '0')}</span>
                {c.thumb ? (
                  <img
                    className="pcard__thumb"
                    src={c.thumb.dataUrl}
                    alt={`page ${c.index + 1}`}
                    style={{ transform: `rotate(${c.rotation}deg)` }}
                  />
                ) : (
                  <span className="pcard__thumb pcard__thumb--empty" />
                )}
                <div className="pcard__tools">
                  <button
                    className="icobtn"
                    title="rotate left"
                    type="button"
                    onClick={() => rotateCard(c.key, -90)}
                  >
                    ↺
                  </button>
                  <button
                    className="icobtn"
                    title="rotate right"
                    type="button"
                    onClick={() => rotateCard(c.key, 90)}
                  >
                    ↻
                  </button>
                  <button
                    className="icobtn icobtn--danger"
                    title="remove page"
                    type="button"
                    onClick={() => removeCard(c.key)}
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  )
}

/* ---------- SPLIT ---------- */

function Split() {
  const [file, setFile] = useState<LoadedFile | null>(null)
  const [size, setSize] = useState(1)
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')

  const load = useCallback(async (files: File[]) => {
    setErr('')
    const f = files[0]
    if (!f) return
    setFile({ id: uid(), name: f.name, bytes: await fileToU8(f), size: f.size })
  }, [])

  const run = useCallback(async () => {
    if (!file) return
    setBusy('splitting…')
    setErr('')
    try {
      const parts = await splitBySize(file.bytes, size)
      const base = file.name.replace(/\.pdf$/i, '')
      parts.forEach((p, i) =>
        saveBytes(p, slugFilename(`${base}-part-${i + 1}`, `part-${i + 1}`)),
      )
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Split failed.')
    } finally {
      setBusy('')
    }
  }, [file, size])

  return (
    <div className="tool">
      <Dropzone accept="application/pdf" multiple={false} label="Drop a PDF to split" onFiles={load} />
      {file && (
        <div className="ctl panel">
          <p className="tick">{file.name} · {formatBytes(file.size)}</p>
          <label className="field">
            <span className="tick">pages per file</span>
            <input
              className="num"
              type="number"
              min={1}
              value={size}
              onChange={(e) => setSize(Math.max(1, Number(e.target.value) || 1))}
            />
          </label>
          <button className="btn btn--primary" type="button" onClick={run} disabled={!!busy}>
            Split → download parts
          </button>
        </div>
      )}
      {busy && <Progress label={busy} />}
      {err && <ErrorNote msg={err} />}
    </div>
  )
}

/* ---------- EXTRACT TEXT (+ AI) ---------- */

function ExtractText() {
  const [file, setFile] = useState<LoadedFile | null>(null)
  const [pages, setPages] = useState<{ page: number; text: string }[]>([])
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [ai, setAi] = useState('')
  const [aiBusy, setAiBusy] = useState<'summary' | 'name' | ''>('')
  const [aiErr, setAiErr] = useState('')
  const [suggestedName, setSuggestedName] = useState('')

  const load = useCallback(async (files: File[]) => {
    const f = files[0]
    if (!f) return
    setErr('')
    setAi('')
    setAiErr('')
    setSuggestedName('')
    setBusy('extracting text…')
    try {
      const bytes = await fileToU8(f)
      setFile({ id: uid(), name: f.name, bytes, size: f.size })
      const { extractText } = await import('../lib/render')
      setPages(await extractText(bytes))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Text extraction failed.')
    } finally {
      setBusy('')
    }
  }, [])

  const allText = useMemo(
    () => pages.map((p) => `--- page ${p.page} ---\n${p.text}`).join('\n\n'),
    [pages],
  )

  const summarize = useCallback(async () => {
    if (!allText.trim()) return
    setAiErr('')
    setAiBusy('summary')
    setAi('')
    try {
      const { complete } = await import('@chirag127/oz-ai')
      const out = await complete(allText.slice(0, 12000), {
        system:
          'You are a precise document analyst. Summarize the PDF text in 5 tight bullet points. If the user later asks about a clause, explain it plainly.',
      })
      setAi(out)
    } catch {
      setAiErr('AI unavailable right now — core extraction still works. Try again later.')
    } finally {
      setAiBusy('')
    }
  }, [allText])

  const suggestName = useCallback(async () => {
    if (!allText.trim()) return
    setAiErr('')
    setAiBusy('name')
    try {
      const { complete } = await import('@chirag127/oz-ai')
      const out = await complete(allText.slice(0, 4000), {
        system:
          'Suggest ONE short, descriptive filename (kebab-case, no extension, ≤6 words) for this document. Reply with only the filename.',
      })
      setSuggestedName(slugFilename(out.trim()))
    } catch {
      setAiErr('AI unavailable right now.')
    } finally {
      setAiBusy('')
    }
  }, [allText])

  const downloadTxt = () => {
    if (!file) return
    const name = (suggestedName || file.name.replace(/\.pdf$/i, '')).replace(/\.pdf$/i, '')
    downloadBlob(new Blob([allText], { type: 'text/plain' }), `${name}.txt`)
  }

  return (
    <div className="tool">
      <Dropzone accept="application/pdf" multiple={false} label="Drop a PDF to extract text" onFiles={load} />
      {busy && <Progress label={busy} />}
      {err && <ErrorNote msg={err} />}

      {pages.length > 0 && (
        <>
          <div className="ctl panel">
            <p className="tick">{pages.length} pages of text · AI is optional polish</p>
            <div className="ctl__row">
              <button className="btn" type="button" onClick={downloadTxt}>Download .txt</button>
              <button className="btn" type="button" onClick={summarize} disabled={!!aiBusy}>
                {aiBusy === 'summary' ? 'thinking…' : 'AI summarize'}
              </button>
              <button className="btn" type="button" onClick={suggestName} disabled={!!aiBusy}>
                {aiBusy === 'name' ? 'thinking…' : 'AI suggest filename'}
              </button>
            </div>
            {suggestedName && (
              <p className="tick">suggested: <span className="mono">{suggestedName}</span></p>
            )}
            {aiErr && <ErrorNote msg={aiErr} />}
            {ai && <pre className="ai-out">{ai}</pre>}
          </div>

          <div className="text-pages">
            {pages.map((p) => (
              <details key={p.page} className="text-page panel">
                <summary className="mono">page {p.page}</summary>
                <pre className="text-page__body">{p.text || '(no extractable text)'}</pre>
              </details>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ---------- EXTRACT IMAGES ---------- */

function ExtractImages() {
  const [imgs, setImgs] = useState<{ page: number; dataUrl: string }[]>([])
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')

  const load = useCallback(async (files: File[]) => {
    const f = files[0]
    if (!f) return
    setErr('')
    setImgs([])
    setBusy('scanning for images…')
    try {
      const bytes = await fileToU8(f)
      const { extractImages } = await import('../lib/render')
      const found = await extractImages(bytes)
      setImgs(found)
      if (!found.length) setErr('No embedded raster images found.')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Image extraction failed.')
    } finally {
      setBusy('')
    }
  }, [])

  const save = (dataUrl: string, i: number) => {
    fetch(dataUrl)
      .then((r) => r.blob())
      .then((b) => downloadBlob(b, `image-${i + 1}.png`))
  }

  return (
    <div className="tool">
      <Dropzone accept="application/pdf" multiple={false} label="Drop a PDF to pull images" onFiles={load} />
      {busy && <Progress label={busy} />}
      {err && <ErrorNote msg={err} />}
      {imgs.length > 0 && (
        <div className="grid">
          {imgs.map((im, i) => (
            <figure key={`${im.page}-${i}`} className="grid__cell panel">
              <img src={im.dataUrl} alt={`image ${i + 1} from page ${im.page}`} />
              <figcaption className="tick">
                p{im.page}
                <button className="btn" type="button" onClick={() => save(im.dataUrl, i)}>
                  save
                </button>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------- IMAGES → PDF ---------- */

function ImagesToPdf() {
  const [items, setItems] = useState<{ key: string; name: string; url: string; bytes: Uint8Array; type: string }[]>([])
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')

  const add = useCallback(async (files: File[]) => {
    setErr('')
    const next: typeof items = []
    for (const f of files) {
      if (!/^image\/(png|jpe?g)$/i.test(f.type)) continue
      const bytes = await fileToU8(f)
      next.push({ key: uid(), name: f.name, url: URL.createObjectURL(f), bytes, type: f.type })
    }
    if (!next.length) {
      setErr('Only PNG and JPG are supported.')
      return
    }
    setItems((p) => [...p, ...next])
  }, [])

  const build = useCallback(async () => {
    if (!items.length) return
    setBusy('building PDF…')
    setErr('')
    try {
      const out = await imagesToPdf(items.map((i) => ({ bytes: i.bytes, type: i.type })))
      saveBytes(out, slugFilename('images', 'images'))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Build failed.')
    } finally {
      setBusy('')
    }
  }, [items])

  return (
    <div className="tool">
      <Dropzone accept="image/png,image/jpeg" multiple label="Drop PNG/JPG images" onFiles={add} />
      {err && <ErrorNote msg={err} />}
      {items.length > 0 && (
        <>
          <div className="ctl__row">
            <button className="btn" type="button" onClick={() => setItems([])}>Clear</button>
            <button className="btn btn--primary" type="button" onClick={build} disabled={!!busy}>
              {items.length} image(s) → PDF
            </button>
          </div>
          {busy && <Progress label={busy} />}
          <div className="grid">
            {items.map((it) => (
              <figure key={it.key} className="grid__cell panel">
                <img src={it.url} alt={it.name} />
                <figcaption className="tick">{it.name}</figcaption>
              </figure>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
