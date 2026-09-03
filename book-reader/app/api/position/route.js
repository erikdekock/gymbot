import { NextResponse } from 'next/server'
import { getSupabaseServer, getCurrentUser } from '../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

const int = (v) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : null)

// Reading position lives server-side so resuming works across devices.
// The client also keeps a localStorage copy as a fast cache; this is the
// source of truth. Position is stored as a STABLE anchor (chapter +
// paragraph + location), never as a page number.
export async function POST(request) {
  const supabase = getSupabaseServer()
  if (!supabase) return NextResponse.json({ ok: true, skipped: 'not configured' })

  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: true, skipped: 'anonymous' })

  let body = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const { error } = await supabase.rpc('save_position', {
    p_chapter: int(body.chapter_number) ?? 1,
    p_paragraph: int(body.paragraph_index) ?? 0,
    p_location: int(body.location) ?? 1,
    p_pct: int(body.progress_pct) ?? 0,
    p_finished: Boolean(body.finished),
  })

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
