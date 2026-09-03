import { NextResponse } from 'next/server'
import { getSupabaseServer, getCurrentUser } from '../../../lib/supabase/server'
import { sendQuestionEmails } from '../../../lib/email'
import { getBookMeta, contextForAnchor } from '../../../lib/content'
import { percentThrough } from '../../../lib/locations'

export const dynamic = 'force-dynamic'

const int = (v) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : null)
const str = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

// A reader's question about a passage: stored first, then emailed. If the mail
// fails the row survives with email_failed = true and can be retried from the
// dashboard — the reader never loses their question to a bad SMTP day.
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

  const question = str(body.question, 4000)
  if (!question) return NextResponse.json({ ok: false, error: 'empty' }, { status: 400 })

  const chapter = int(body.chapter_number)
  const location = int(body.location)
  const selectedText = str(body.selected_text, 2000)

  const { data: inserted, error } = await supabase
    .from('questions')
    .insert({
      user_id: user.id,
      chapter_number: chapter,
      location,
      paragraph_index: int(body.paragraph_index),
      char_start: int(body.char_start),
      char_end: int(body.char_end),
      selected_text: selectedText,
      question,
      status: 'open',
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  // Name for the email — from the reader's own row.
  const { data: reader } = await supabase
    .from('readers')
    .select('first_name, last_name')
    .eq('id', user.id)
    .maybeSingle()
  const readerName = [reader?.first_name, reader?.last_name].filter(Boolean).join(' ')

  const meta = getBookMeta()
  const origin = new URL(request.url).origin

  const mail = await sendQuestionEmails({
    readerName,
    readerEmail: user.email,
    chapter,
    location,
    total: meta.totalLocations,
    percent: percentThrough(location, meta.totalLocations),
    selectedText,
    context: contextForAnchor(chapter, int(body.paragraph_index)),
    question,
    dashboardUrl: `${origin}/dashboard`,
  })

  if (!mail.ok) {
    await supabase
      .from('questions')
      .update({ email_failed: true, email_error: String(mail.error).slice(0, 300) })
      .eq('id', inserted.id)
  }

  return NextResponse.json({ ok: true, id: inserted.id, emailed: mail.ok })
}
