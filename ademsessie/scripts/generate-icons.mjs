// Generate PWA icons (PNG) and the SVG favicon from the shared icon source.
// Run: npm run icons
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import sharp from 'sharp'
import { iconSVG } from './icon.js'

const here = dirname(fileURLToPath(import.meta.url))
const pub = resolve(here, '../public')
const icons = resolve(pub, 'icons')

async function png(svg, size, out) {
  const buf = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer()
  await writeFile(out, buf)
  console.log('wrote', out)
}

await mkdir(icons, { recursive: true })

// Full-bleed icons (orb fills the tile).
await png(iconSVG(512, 1), 192, resolve(icons, 'icon-192.png'))
await png(iconSVG(512, 1), 512, resolve(icons, 'icon-512.png'))
await png(iconSVG(180, 1), 180, resolve(pub, 'apple-touch-icon.png'))

// Maskable: shrink the orb so it survives the platform safe-zone crop.
await png(iconSVG(512, 0.72), 512, resolve(icons, 'icon-maskable-512.png'))

// SVG favicon.
await writeFile(resolve(pub, 'favicon.svg'), iconSVG(64, 1))
console.log('wrote', resolve(pub, 'favicon.svg'))
