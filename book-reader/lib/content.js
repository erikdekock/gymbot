import fs from 'fs'
import path from 'path'
import { parseMarkdown } from './markdown'

const CONTENT_DIR = path.join(process.cwd(), 'content')

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
    .filter((f) => f.endsWith('.md'))
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

  return chapters
}
