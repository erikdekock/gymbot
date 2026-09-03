import { NextResponse } from 'next/server'
import { getSupabaseAdmin, isAdminConfigured } from '../../../../lib/supabase/server'
import { isDashboardAuthed } from '../../../../lib/dashboard-auth'
import { getChapters } from '../../../../lib/content'

export const dynamic = 'force-dynamic'

// All dashboard reads happen here, server-side, with the service-role key —
// the browser never holds a key that can read anyone's data. Gated by the
// httpOnly dashboard cookie.
async function safeSelect(admin, table, select = '*', order) {
  try {
    let q = admin.from(table).select(select)
    if (order) q = q.order(order.column, { ascending: false }).limit(order.limit || 5000)
    const { data, error } = await q
    if (error) return { rows: [], missing: true }
    return { rows: data || [], missing: false }
  } catch {
    return { rows: [], missing: true }
  }
}

export async function GET() {
  if (!isDashboardAuthed()) {
    return NextResponse.json({ ok: false, error: 'locked' }, { status: 401 })
  }
  if (!isAdminConfigured()) {
    return NextResponse.json({
      ok: true,
      configured: false,
      missingTables: [],
      data: null,
    })
  }

  const admin = getSupabaseAdmin()

  const [readers, stats, annotations, feedback, subscribers, shares, questions, surveys, events] =
    await Promise.all([
      safeSelect(admin, 'readers'),
      safeSelect(admin, 'chapter_stats'),
      safeSelect(admin, 'annotations'),
      safeSelect(admin, 'feedback'),
      safeSelect(admin, 'subscribers'),
      safeSelect(admin, 'shares'),
      safeSelect(admin, 'questions', '*', { column: 'created_at' }),
      safeSelect(admin, 'survey_responses', '*', { column: 'created_at' }),
      safeSelect(admin, 'events', '*', { column: 'occurred_at', limit: 20000 }),
    ])

  const missingTables = [
    ['readers', readers], ['chapter_stats', stats], ['annotations', annotations],
    ['feedback', feedback], ['subscribers', subscribers], ['shares', shares],
    ['questions', questions], ['survey_responses', surveys], ['events', events],
  ]
    .filter(([, r]) => r.missing)
    .map(([n]) => n)

  // Chapter titles + the location scale, so insights can be shown by location.
  const chapters = getChapters().map((c) => ({
    number: c.number,
    title: c.title,
    startLocation: c.startLocation,
    totalLocations: c.totalLocations,
  }))

  return NextResponse.json({
    ok: true,
    configured: true,
    missingTables,
    chapters,
    totalLocations: chapters.length ? chapters[0].totalLocations : 1,
    data: {
      readers: readers.rows,
      chapter_stats: stats.rows,
      annotations: annotations.rows,
      feedback: feedback.rows,
      subscribers: subscribers.rows,
      shares: shares.rows,
      questions: questions.rows,
      survey_responses: surveys.rows,
      events: events.rows,
    },
  })
}

// Actions on a question: mark answered, or retry the notification email.
export async function POST(request) {
  if (!isDashboardAuthed()) {
    return NextResponse.json({ ok: false, error: 'locked' }, { status: 401 })
  }
  const admin = getSupabaseAdmin()
  if (!admin) return NextResponse.json({ ok: false, error: 'no service key' }, { status: 503 })

  let body = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const { action, id } = body
  if (!id) return NextResponse.json({ ok: false }, { status: 400 })

  if (action === 'answer') {
    const { error } = await admin
      .from('questions')
      .update({ status: 'answered', answered_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'reopen') {
    const { error } = await admin
      .from('questions')
      .update({ status: 'open', answered_at: null })
      .eq('id', id)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'retry_email') {
    const { sendQuestionEmails } = await import('../../../../lib/email')
    const { getBookMeta, contextForAnchor } = await import('../../../../lib/content')
    const { percentThrough } = await import('../../../../lib/locations')

    const { data: q } = await admin.from('questions').select('*').eq('id', id).maybeSingle()
    if (!q) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })

    const { data: reader } = await admin
      .from('readers')
      .select('first_name, last_name, email')
      .eq('id', q.user_id)
      .maybeSingle()

    const meta = getBookMeta()
    const mail = await sendQuestionEmails({
      readerName: [reader?.first_name, reader?.last_name].filter(Boolean).join(' '),
      readerEmail: reader?.email,
      chapter: q.chapter_number,
      location: q.location,
      total: meta.totalLocations,
      percent: percentThrough(q.location, meta.totalLocations),
      selectedText: q.selected_text,
      context: contextForAnchor(q.chapter_number, q.paragraph_index),
      question: q.question,
      dashboardUrl: `${new URL(request.url).origin}/dashboard`,
    })

    await admin
      .from('questions')
      .update({ email_failed: !mail.ok, email_error: mail.ok ? null : String(mail.error).slice(0, 300) })
      .eq('id', id)

    return NextResponse.json({ ok: mail.ok })
  }

  return NextResponse.json({ ok: false, error: 'unknown action' }, { status: 400 })
}
