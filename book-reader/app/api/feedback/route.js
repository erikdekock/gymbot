import { NextResponse } from 'next/server'
import { getSupabaseServer, getCurrentUser } from '../../../lib/supabase/server'
import { sendNoteEmail } from '../../../lib/email'
import { getBookMeta } from '../../../lib/content'
import { percentThrough } from '../../../lib/locations'

export const dynamic = 'force-dynamic'

const int = (v) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : null)
const str = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

// Anytime feedback — stored with the reader's current location and, if they
// had something selected, the passage they were looking at.
export async function POST(request) {
  const supabase = getSupabaseServer()
  if (!supabase) return NextResponse.json({ ok: false, error: 'not configured' }, { status: 503 })

  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })

  let body = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const message = str(body.message, 4000)
  if (!message) return NextResponse.json({ ok: false, error: 'empty' }, { status: 400 })

  const chapter = int(body.chapter_number)
  const location = int(body.location)

  const { data: inserted, error } = await supabase
    .from('feedback')
    .insert({
      user_id: user.id,
      chapter_number: chapter,
      location,
      selected_text: str(body.selected_text, 2000),
      rating: int(body.rating),
      message,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  const { data: reader } = await supabase
    .from('readers')
    .select('first_name, last_name')
    .eq('id', user.id)
    .maybeSingle()

  const meta = getBookMeta()
  const mail = await sendNoteEmail({
    kind: 'feedback',
    readerName: [reader?.first_name, reader?.last_name].filter(Boolean).join(' '),
    readerEmail: user.email,
    chapter,
    location,
    total: meta.totalLocations,
    percent: percentThrough(location, meta.totalLocations),
    body: message,
    extra: body.selected_text ? `Bij: “${String(body.selected_text).slice(0, 240)}”` : null,
    dashboardUrl: `${new URL(request.url).origin}/dashboard`,
  })

  if (!mail.ok) {
    await supabase
      .from('feedback')
      .update({ email_failed: true, email_error: String(mail.error).slice(0, 300) })
      .eq('id', inserted.id)
  }

  return NextResponse.json({ ok: true, emailed: mail.ok })
}
