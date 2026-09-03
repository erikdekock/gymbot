import fs from 'fs'
import path from 'path'
import Link from 'next/link'
import { parseMarkdown } from '../../lib/markdown'

export const metadata = { title: 'Privacy' }

// Plain-language privacy page. The text lives in content/_privacy.md so it can
// be edited without touching code.
export default function PrivacyPage() {
  let html = ''
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), 'content', '_privacy.md'), 'utf8')
    html = parseMarkdown(raw).html
  } catch {
    html = '<p>Privacybeleid nog niet beschikbaar.</p>'
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-16">
      <article
        className="prose-book"
        style={{ color: 'var(--ink)' }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <p className="mt-12 text-sm">
        <Link href="/" className="underline underline-offset-4" style={{ color: 'var(--ink-soft)' }}>
          ← Terug
        </Link>
      </p>
    </main>
  )
}
