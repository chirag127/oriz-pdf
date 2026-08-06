/** Small pure helpers — filename slugs, list moves. Fully unit-tested. */

/** Make a safe PDF filename from an arbitrary title. */
export function slugFilename(title: string, fallback = 'document'): string {
  const base = title
    .normalize('NFKD')
    .replace(/[^\w\s.-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80)
    .toLowerCase()
  const name = base || fallback
  return name.endsWith('.pdf') ? name : `${name}.pdf`
}

/** Move an item within a list from `from` to `to` (immutable). */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length) return list.slice()
  const copy = list.slice()
  const [item] = copy.splice(from, 1)
  const dest = Math.max(0, Math.min(to, copy.length))
  copy.splice(dest, 0, item)
  return copy
}
