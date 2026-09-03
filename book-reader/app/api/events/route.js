import { NextResponse } from 'next/server'
import { getSupabaseServer, getCurrentUser } from '../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

const ALLOWED = new Set([
  'session_started', 'session_ended', 'chapter_entered', 'page_viewed', 'page_dwell',
  'stall_detected', 'reread_detected', 'furthest_point_updated', 'progress_milestone',
  'book_finished', 'tab_hidden', 'tab_visible', 'text_selected', 'text_copied',
  'tooltip_opened', 'interstitial_viewed', 'theme_changed', 'font_size_changed',
  'share_initiated', 'referral_landed', 'resume_prompt_accepted', 'feedback_opened',
  'survey_shown', 'survey_completed', 'survey_skipped', 'question_asked',
  'consent_granted', 'consent_declined', 'highlight_created', 'note_created', 'like_created',
])

const int = (v) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : null)
const str = (v, max = 200) => (typeof v === 'string' && v ? v.slice(0, max) : null)

export async function POST(request) {
  // sendBeacon posts a Blob; both paths land here as JSON.
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'bad json' }, { status: 400 })
  }

  const supabase = getSupabaseServer()
  if (!supabase) return NextResponse.json({ ok: true, skipped: 'not configured' })

  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: true, skipped: 'anonymous' })

  const events = Array.isArray(body?.events) ? body.events.slice(0, 200) : []
  if (!events.length) return NextResponse.json({ ok: true, inserted: 0 })

  const ctx = body?.context || {}
  const h = request.headers
  // Coarse geo only — country and city. The raw IP is never read or stored.
  const country = str(h.get('x-vercel-ip-country'), 8)
  const city = (() => {
    const raw = h.get('x-vercel-ip-city')
    if (!raw) return null
    try {
      return decodeURIComponent(raw).slice(0, 120)
    } catch {
      return raw.slice(0, 120)
    }
  })()

  const sessionId = str(body?.session_id, 64)

  const rows = events
    .filter((e) => e && ALLOWED.has(e.event_type))
    .map((e) => ({
      user_id: user.id,
      session_id: sessionId,
      event_type: e.event_type,
      chapter_number: int(e.chapter_number),
      location: int(e.location),
      payload: e.payload && typeof e.payload === 'object' ? e.payload : {},
      occurred_at: e.occurred_at || new Date().toISOString(),
      device_type: str(ctx.device_type, 20),
      os: str(ctx.os, 40),
      browser: str(ctx.browser, 40),
      screen_w: int(ctx.screen_w),
      screen_h: int(ctx.screen_h),
      viewport_w: int(ctx.viewport_w),
      viewport_h: int(ctx.viewport_h),
      language: str(ctx.language, 20),
      timezone: str(ctx.timezone, 60),
      referrer: str(ctx.referrer, 500),
      utm_source: str(ctx.utm_source, 120),
      utm_medium: str(ctx.utm_medium, 120),
      utm_campaign: str(ctx.utm_campaign, 120),
      country,
      city,
    }))

  if (!rows.length) return NextResponse.json({ ok: true, inserted: 0 })

  const { error } = await supabase.from('events').insert(rows)
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  // Roll up the derived per-reader fields (furthest location, totals, medians).
  try {
    await supabase.rpc('refresh_reader_derived', { p_user_id: user.id })
  } catch {
    /* derived fields are best-effort */
  }

  return NextResponse.json({ ok: true, inserted: rows.length })
}
