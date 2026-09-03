// ===========================================================================
//  Stable locations — two systems, because pages are not stable.
//
//  A page depends on the viewport and the font size, so it can never be used
//  to refer to a place in the book. Instead:
//
//  A) EXACT ANCHOR (machine-readable): chapter_number + paragraph_index +
//     char_start/char_end within that paragraph's text + the selected text.
//     Survives any re-flow, and can be re-found and re-highlighted later.
//
//  B) LOCATION (human-readable): the whole book is split into consecutive
//     ~150-word segments numbered from 1 across the entire book — Kindle's
//     "locations". Every paragraph knows the location it starts at. This is
//     what a person sees and what emails, surveys and the dashboard quote.
//
//  The location numbering is computed once at build time (see lib/content.js)
//  from the text alone, so it is identical on every device.
// ===========================================================================

// Block elements that count as a "paragraph" for anchoring. The index of a
// block among these is the paragraph_index — it must match the server-side
// numbering in lib/content.js exactly.
export const BLOCK_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, blockquote, li, pre'

export function blocksIn(container) {
  if (!container) return []
  return Array.from(container.querySelectorAll(BLOCK_SELECTOR))
}

// --- A) exact anchors -------------------------------------------------------

// Character offset of `node`+`offset` within the block's full textContent.
function offsetWithinBlock(block, node, offset) {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, null)
  let count = 0
  let current = walker.nextNode()
  while (current) {
    if (current === node) return count + offset
    count += current.textContent.length
    current = walker.nextNode()
  }
  return count
}

/**
 * Build a durable anchor from the current DOM Selection.
 * Returns null when the selection is empty or outside the reading column.
 */
export function anchorFromSelection(selection, container, chapterNumber) {
  if (!selection || selection.isCollapsed || !container) return null
  const text = selection.toString().trim()
  if (!text) return null

  const range = selection.getRangeAt(0)
  const startBlock = closestBlock(range.startContainer, container)
  if (!startBlock) return null

  const blocks = blocksIn(container)
  const paragraphIndex = blocks.indexOf(startBlock)
  if (paragraphIndex === -1) return null

  const charStart = offsetWithinBlock(startBlock, range.startContainer, range.startOffset)

  // Selections can run past the end of the first block; clamp to that block so
  // the anchor always describes one paragraph plus a length.
  const endBlock = closestBlock(range.endContainer, container)
  const charEnd =
    endBlock === startBlock
      ? offsetWithinBlock(startBlock, range.endContainer, range.endOffset)
      : Math.min(startBlock.textContent.length, charStart + text.length)

  return {
    chapter_number: chapterNumber,
    paragraph_index: paragraphIndex,
    char_start: Math.min(charStart, charEnd),
    char_end: Math.max(charStart, charEnd),
    selected_text: text.slice(0, 2000),
  }
}

function closestBlock(node, container) {
  let el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node
  while (el && el !== container) {
    if (el.matches && el.matches(BLOCK_SELECTOR)) return el
    el = el.parentElement
  }
  return null
}

/**
 * Re-find a stored anchor in the current DOM. Returns a Range, or null if the
 * text has changed enough that the anchor no longer resolves.
 */
export function rangeFromAnchor(container, anchor) {
  if (!container || !anchor) return null
  const blocks = blocksIn(container)
  const block = blocks[anchor.paragraph_index]
  if (!block) return null

  let start = anchor.char_start
  let end = anchor.char_end

  // If the text moved slightly, fall back to searching for the stored text.
  const blockText = block.textContent || ''
  if (anchor.selected_text && blockText.slice(start, end) !== anchor.selected_text) {
    const found = blockText.indexOf(anchor.selected_text)
    if (found === -1) return null
    start = found
    end = found + anchor.selected_text.length
  }

  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, null)
  const range = document.createRange()
  let count = 0
  let node = walker.nextNode()
  let startSet = false

  while (node) {
    const len = node.textContent.length
    if (!startSet && count + len >= start) {
      range.setStart(node, Math.max(0, start - count))
      startSet = true
    }
    if (startSet && count + len >= end) {
      range.setEnd(node, Math.max(0, end - count))
      return range
    }
    count += len
    node = walker.nextNode()
  }
  return startSet ? range : null
}

/** Scroll/paginate to an anchor and flash a highlight over it. */
export function highlightAnchor(container, anchor, className = 'anchor-flash') {
  const range = rangeFromAnchor(container, anchor)
  if (!range) return null
  try {
    const mark = document.createElement('mark')
    mark.className = className
    range.surroundContents(mark)
    return mark
  } catch {
    // Range spans element boundaries — not fatal, just skip the visual.
    return null
  }
}

// --- B) human locations -----------------------------------------------------

/**
 * The location number for a point inside a paragraph. `startLocation` comes
 * from the build-time numbering; we interpolate by word offset within the
 * paragraph so long paragraphs don't all collapse to one number.
 */
export function locationAt(paragraph, charOffset, wordsPerLocation) {
  if (!paragraph) return 1
  const before = (paragraph.text || '').slice(0, charOffset || 0)
  const words = countWords(before)
  return (paragraph.startLocation || 1) + Math.floor(words / wordsPerLocation)
}

export function countWords(text) {
  if (!text) return 0
  const m = text.trim().match(/\S+/g)
  return m ? m.length : 0
}

/** "% through the book" from a location number. */
export function percentThrough(location, totalLocations) {
  if (!totalLocations) return 0
  return Math.max(0, Math.min(100, Math.round((location / totalLocations) * 100)))
}

/**
 * Which paragraph starts the currently visible page.
 * In the paginated column layout each block sits in exactly one column, and
 * the column index is its offsetLeft divided by the column pitch — so this
 * maps the current page back to a paragraph, and therefore to a location.
 */
export function firstBlockOnPage(container, pageIndex, pitch) {
  const blocks = blocksIn(container)
  if (!blocks.length || !pitch) return 0
  for (let i = 0; i < blocks.length; i++) {
    const col = Math.floor((blocks[i].offsetLeft + 1) / pitch)
    if (col >= pageIndex) return i
  }
  return blocks.length - 1
}
