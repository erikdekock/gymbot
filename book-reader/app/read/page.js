import Reader from '../../components/Reader'
import { getChapters } from '../../lib/content'
import { BOOK } from '../../lib/book-config'

// Build-time/server read of the markdown chapters, handed to the client reader.
export default function ReadPage() {
  const chapters = getChapters()
  const bookTitle = BOOK.title

  if (!chapters.length) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 text-center">
        <div>
          <h1 className="font-display text-2xl" style={{ color: 'var(--ink)' }}>
            No chapters yet
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--ink-soft)' }}>
            Add <code>chapter-01.md</code> files to the <code>/content</code> folder.
          </p>
        </div>
      </main>
    )
  }

  return <Reader chapters={chapters} bookTitle={bookTitle} lang={BOOK.lang} />
}
