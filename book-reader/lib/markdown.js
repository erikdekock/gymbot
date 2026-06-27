// Tiny, dependency-free Markdown + frontmatter parser.
// Intentionally small: a book is mostly headings, paragraphs, emphasis,
// blockquotes and the occasional scene break. Keeping this in-repo means
// `npm install` only needs Next, React and supabase-js.

function parseFrontmatter(raw) {
  const text = raw.replace(/^﻿/, '')
  const match = /^---\s*\n([\s\S]*?)\n---\s*\n?/.exec(text)
  if (!match) return { data: {}, content: text }

  const data = {}
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    let value = line.slice(idx + 1).trim()
    value = value.replace(/^["']|["']$/g, '')
    data[key] = value
  }
  return { data, content: text.slice(match[0].length) }
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// Inline formatting: bold, italic, code, em-dashes, smart quotes-ish.
function inline(text) {
  let out = escapeHtml(text)
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>')
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
  out = out.replace(/_([^_\n]+)_/g, '<em>$1</em>')
  out = out.replace(/--/g, '&mdash;')
  return out
}

// Block-level conversion. Returns an HTML string.
function toHtml(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const html = []
  let paragraph = []
  let listType = null
  let listItems = []

  const flushParagraph = () => {
    if (paragraph.length) {
      html.push(`<p>${inline(paragraph.join(' '))}</p>`)
      paragraph = []
    }
  }
  const flushList = () => {
    if (listItems.length) {
      const tag = listType
      const items = listItems.map((i) => `<li>${inline(i)}</li>`).join('')
      html.push(`<${tag}>${items}</${tag}>`)
      listItems = []
      listType = null
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()

    if (!line.trim()) {
      flushParagraph()
      flushList()
      continue
    }

    // Scene break / horizontal rule: ---, ***, * * *
    if (/^(\*\s*){3,}$/.test(line) || /^(-\s*){3,}$/.test(line) || /^(_\s*){3,}$/.test(line)) {
      flushParagraph()
      flushList()
      html.push('<hr class="scene-break" />')
      continue
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      flushParagraph()
      flushList()
      const level = heading[1].length
      html.push(`<h${level}>${inline(heading[2].trim())}</h${level}>`)
      continue
    }

    if (/^>\s?/.test(line)) {
      flushParagraph()
      flushList()
      html.push(`<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`)
      continue
    }

    const ul = /^[-*+]\s+(.*)$/.exec(line)
    if (ul) {
      flushParagraph()
      if (listType && listType !== 'ul') flushList()
      listType = 'ul'
      listItems.push(ul[1])
      continue
    }

    const ol = /^\d+\.\s+(.*)$/.exec(line)
    if (ol) {
      flushParagraph()
      if (listType && listType !== 'ol') flushList()
      listType = 'ol'
      listItems.push(ol[1])
      continue
    }

    flushList()
    paragraph.push(line.trim())
  }

  flushParagraph()
  flushList()
  return html.join('\n')
}

export function parseMarkdown(raw) {
  const { data, content } = parseFrontmatter(raw)
  return { frontmatter: data, html: toHtml(content) }
}
