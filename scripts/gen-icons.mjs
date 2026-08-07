import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const out = resolve(here, '../public/icons')
mkdirSync(out, { recursive: true })

const anySvg = readFileSync(resolve(here, 'icon-any.svg'))
const maskSvg = readFileSync(resolve(here, 'icon-maskable.svg'))

const jobs = [
  { svg: anySvg, size: 192, name: 'icon-192.png' },
  { svg: anySvg, size: 256, name: 'icon-256.png' },
  { svg: anySvg, size: 384, name: 'icon-384.png' },
  { svg: anySvg, size: 512, name: 'icon-512.png' },
  { svg: maskSvg, size: 512, name: 'icon-maskable-512.png' },
]

for (const j of jobs) {
  await sharp(j.svg, { density: 384 }).resize(j.size, j.size).png().toFile(resolve(out, j.name))
  console.log('wrote', j.name)
}
