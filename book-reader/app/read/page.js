import Reader from '../../components/Reader'
import { getChapters } from '../../lib/content'
import { BOOK } from '../../lib/book-config'

export const dynamic = 'force-dynamic'

// Build-time/server read of the markdown chapters, handed to the client reader.
// Paragraph *text* stays on the server — the client only needs each paragraph's
// starting location number, which is what makes positions stable.
export default function ReadPage() {
  const chapters = getChapters()
  const bookTitle = BOOK.title
  const totalLocations = chapters.length ? chapters[0].totalLocations : 1

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

  const slim = chapters.map((c) => ({
    number: c.number,
    title: c.title,
    html: c.html,
    startLocation: c.startLocation,
    locations: c.paragraphs.map((p) => p.startLocation),
  }))

  return (
    <Reader
      chapters={slim}
      bookTitle={bookTitle}
      lang={BOOK.lang}
      totalLocations={totalLocations}
    />
  )
}
