import { NextResponse } from 'next/server'
import { getSupabaseServer, getCurrentUser } from '../../../lib/supabase/server'
import { sendNoteEmail } from '../../../lib/email'
import { getBookMeta } from '../../../lib/content'

export const dynamic = 'force-dynamic'

const int = (v) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : null)

// One survey response per reader per chapter (upsert, so a re-submit replaces
// rather than duplicates). Open-text answers are emailed to the author.
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

  const chapter = int(body.chapter_number)
  const answers = body.answers && typeof body.answers === 'object' ? body.answers : {}

  const { error } = await supabase.from('survey_responses').upsert(
    {
      user_id: user.id,
      chapter_number: chapter,
      kind: body.kind === 'end_of_book' ? 'end_of_book' : 'chapter',
      answers,
    },
    { onConflict: 'user_id,chapter_number' }
  )

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  // Only bother the author when there's something written.
  const openText = Object.entries(answers)
    .filter(([, v]) => typeof v === 'string' && v.trim().length > 1)
    .map(([k, v]) => `${k}: ${v.trim()}`)
    .join('\n\n')

  if (openText) {
    const { data: reader } = await supabase
      .from('readers')
      .select('first_name, last_name')
      .eq('id', user.id)
      .maybeSingle()

    const meta = getBookMeta()
    const rating = answers.rating ? `Cijfer: ${answers.rating}/5` : null
    const comprehension = answers.comprehension ? `Te volgen: ${answers.comprehension}` : null

    await sendNoteEmail({
      kind: 'survey',
      readerName: [reader?.first_name, reader?.last_name].filter(Boolean).join(' '),
      readerEmail: user.email,
      chapter,
      location: null,
      total: meta.totalLocations,
      percent: null,
      body: openText,
      extra: [rating, comprehension].filter(Boolean).join(' · '),
      dashboardUrl: `${new URL(request.url).origin}/dashboard`,
    })
  }

  return NextResponse.json({ ok: true })
}
