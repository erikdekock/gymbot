import fs from 'fs'
import path from 'path'
import { parseMarkdown } from './markdown'
import { BOOK } from './book-config'

const CONTENT_DIR = path.join(process.cwd(), 'content')

// Same block set as lib/locations.js BLOCK_SELECTOR — the Nth match here must
// be the Nth match in the browser, because that index *is* the anchor.
const BLOCK_RE = /<(p|h[1-6]|blockquote|li|pre)\b[^>]*>([\s\S]*?)<\/\1>/gi

const stripTags = (html) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&mdash;/g, '—')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')

const countWords = (t) => {
  const m = (t || '').trim().match(/\S+/g)
  return m ? m.length : 0
}

// Reads every chapter-*.md file from /content, parses frontmatter + body,
// and returns chapters sorted by chapter_number. Runs on the server only.
export function getChapters() {
  let files = []
  try {
    files = fs.readdirSync(CONTENT_DIR)
  } catch {
    return []
  }

  const chapters = files
    // Underscore-prefixed files are configuration, not chapters
    // (_privacy.md, _survey.js) — they must never enter the book.
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
    .map((file) => {
      const raw = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8')
      const { frontmatter, html } = parseMarkdown(raw)

      // Fall back to the number embedded in the filename if frontmatter is missing.
      const fromName = /(\d+)/.exec(file)
      const number = Number(frontmatter.chapter_number ?? (fromName ? fromName[1] : 0))

      return {
        file,
        number,
        title: frontmatter.title || `Chapter ${number}`,
        html,
      }
    })
    .sort((a, b) => a.number - b.number)

  return withLocations(chapters)
}

/**
 * Numbers the whole book into consecutive ~150-word locations and records,
 * for every paragraph, the location it starts at. Deterministic: it depends
 * only on the text, so every device agrees.
 */
export function withLocations(chapters) {
  const per = BOOK.wordsPerLocation || 150
  let words = 0

  const out = chapters.map((chapter) => {
    const paragraphs = []
    BLOCK_RE.lastIndex = 0
    let match
    while ((match = BLOCK_RE.exec(chapter.html)) !== null) {
      const text = stripTags(match[2]).replace(/\s+/g, ' ').trim()
      paragraphs.push({
        index: paragraphs.length,
        text,
        words: countWords(text),
        startLocation: Math.floor(words / per) + 1,
      })
      words += countWords(text)
    }

    return {
      ...chapter,
      paragraphs,
      startLocation: paragraphs.length ? paragraphs[0].startLocation : Math.floor(words / per) + 1,
      wordCount: paragraphs.reduce((s, p) => s + p.words, 0),
    }
  })

  const totalLocations = Math.max(1, Math.ceil(words / per))
  return out.map((c) => ({ ...c, totalLocations }))
}

/** Total locations in the book (cheap: derived from the same pass). */
export function getBookMeta() {
  const chapters = getChapters()
  return {
    totalLocations: chapters.length ? chapters[0].totalLocations : 1,
    chapterCount: chapters.length,
    wordCount: chapters.reduce((s, c) => s + (c.wordCount || 0), 0),
  }
}

/**
 * The paragraph text around an anchor — used to give the author ~1 paragraph
 * of context in the question email.
 */
export function contextForAnchor(chapterNumber, paragraphIndex) {
  const chapters = getChapters()
  const chapter = chapters.find((c) => c.number === Number(chapterNumber))
  if (!chapter) return ''
  const p = chapter.paragraphs[paragraphIndex]
  return p ? p.text : ''
}
