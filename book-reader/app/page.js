import Link from 'next/link'
import { getChapters } from '../lib/content'

export default function Home() {
  const chapters = getChapters()
  const bookTitle = 'The Book'
  const author = 'by Your Name'

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <div
          className="panel mx-auto flex aspect-[3/4] max-w-[18rem] flex-col items-center justify-center rounded-2xl px-8"
          style={{ background: 'var(--panel)' }}
        >
          <p
            className="mb-6 text-[11px] uppercase tracking-[0.32em]"
            style={{ color: 'var(--accent)' }}
          >
            A Novel
          </p>
          <h1
            className="font-display text-4xl leading-tight"
            style={{ color: 'var(--ink)' }}
          >
            {bookTitle}
          </h1>
          <div
            className="my-6 h-px w-12"
            style={{ background: 'var(--rule)' }}
            aria-hidden="true"
          />
          <p className="font-display text-sm italic" style={{ color: 'var(--ink-soft)' }}>
            {author}
          </p>
        </div>

        <Link
          href="/read"
          className="mt-9 inline-block rounded-full px-8 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: 'var(--accent)' }}
        >
          Start reading
        </Link>

        <p className="mt-5 text-xs" style={{ color: 'var(--ink-soft)' }}>
          {chapters.length} {chapters.length === 1 ? 'chapter' : 'chapters'} · saved as you read
        </p>
      </div>
    </main>
  )
}
