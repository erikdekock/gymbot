'use client'

import { supabase } from './supabase'

// Thin wrappers over the Supabase RPC functions (see supabase/schema.sql).
// Every call is a no-op + warning if analytics isn't configured, so the
// reader never breaks because of a missing env var or a network blip.

async function rpc(name, args) {
  if (!supabase) return { skipped: true }
  try {
    const { error } = await supabase.rpc(name, args)
    if (error) console.warn(`[analytics] ${name} failed:`, error.message)
    return { error }
  } catch (e) {
    console.warn(`[analytics] ${name} threw:`, e?.message || e)
    return { error: e }
  }
}

// Called from the welcome modal (name/email optional) and on every load so the
// reader row always exists.
export function registerReader(readerId, name, email) {
  return rpc('register_reader', {
    p_id: readerId,
    p_name: name || null,
    p_email: email || null,
  })
}

// Atomically accumulates time/scroll/page-views for a chapter.
export function trackChapter(readerId, { chapter, title, seconds, scrollPct, pages, isView }) {
  return rpc('track_chapter', {
    p_reader_id: readerId,
    p_chapter: chapter,
    p_title: title || null,
    p_seconds: Math.round(seconds || 0),
    p_scroll: Math.round(scrollPct || 0),
    p_pages: Math.round(pages || 0),
    p_is_view: Boolean(isView),
  })
}

// Updates overall progress %, current position, and finished flag.
export function updateProgress(readerId, { pct, chapter, page, finished }) {
  return rpc('update_progress', {
    p_reader_id: readerId,
    p_pct: Math.round(pct || 0),
    p_chapter: chapter || 1,
    p_page: page || 0,
    p_finished: Boolean(finished),
  })
}
