// ===========================================================================
//  Outgoing mail (Resend). Server-only.
//
//  Every send is best-effort: the caller stores its record first and only then
//  tries to mail. A failure returns { ok:false } so the row can be flagged
//  email_failed and retried from the dashboard — nothing is ever lost because
//  an email bounced.
// ===========================================================================

import { Resend } from 'resend'
import { BOOK } from './book-config'

const FROM = process.env.MAIL_FROM || 'Het Zal <post@hetzal.nl>'
const AUTHOR = process.env.AUTHOR_EMAIL || ''

export const isMailConfigured = () => Boolean(process.env.RESEND_API_KEY && AUTHOR)

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

const nl = (n) => new Intl.NumberFormat('nl-NL').format(Math.round(n || 0))

// Shared shell so every mail looks like it comes from the same book.
function shell(inner) {
  return `<!doctype html><html lang="nl"><body style="margin:0;padding:0;background:#f6f1e7;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f1e7;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fbf8f1;border:1px solid rgba(43,38,34,.12);border-radius:14px;padding:32px;font-family:Georgia,'Times New Roman',serif;color:#2b2622;">
        ${inner}
        <tr><td style="padding-top:28px;border-top:1px solid rgba(43,38,34,.12);color:#6b6256;font-size:12px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
          ${esc(BOOK.title)} — ${esc(BOOK.author)}
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`
}

function place({ chapter, location, total, percent }) {
  const bits = []
  if (chapter != null) bits.push(`Hoofdstuk ${esc(chapter)}`)
  if (location != null && total) bits.push(`locatie ${nl(location)} van ${nl(total)}`)
  if (percent != null) bits.push(`${esc(percent)}% door het boek`)
  return bits.join(' · ')
}

async function send(payload) {
  if (!isMailConfigured()) return { ok: false, error: 'mail not configured' }
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send(payload)
    if (error) return { ok: false, error: error.message || String(error) }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e?.message || String(e) }
  }
}

// --- a reader's question ----------------------------------------------------

export async function sendQuestionEmails({
  readerName, readerEmail, chapter, location, total, percent,
  selectedText, context, question, dashboardUrl,
}) {
  const where = place({ chapter, location, total, percent })

  const authorHtml = shell(`
    <tr><td style="font-size:13px;color:#6b6256;font-family:-apple-system,Segoe UI,Roboto,sans-serif;padding-bottom:6px;">
      Vraag van <strong style="color:#2b2622;">${esc(readerName || 'een lezer')}</strong>
      &lt;${esc(readerEmail)}&gt;
    </td></tr>
    <tr><td style="font-size:13px;color:#9b6a43;font-family:-apple-system,Segoe UI,Roboto,sans-serif;padding-bottom:18px;">${where}</td></tr>
    <tr><td style="padding:0 0 18px;">
      <blockquote style="margin:0;padding:10px 0 10px 16px;border-left:3px solid #9b6a43;color:#2b2622;font-size:16px;line-height:1.6;font-style:italic;">
        ${esc(selectedText)}
      </blockquote>
      ${context ? `<p style="margin:10px 0 0;padding-left:19px;color:#6b6256;font-size:13px;line-height:1.6;">${esc(context)}</p>` : ''}
    </td></tr>
    <tr><td style="font-size:16px;line-height:1.65;padding-bottom:18px;">${esc(question).replace(/\n/g, '<br>')}</td></tr>
    ${dashboardUrl ? `<tr><td style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:13px;"><a href="${esc(dashboardUrl)}" style="color:#9b6a43;">Bekijk in het dashboard</a></td></tr>` : ''}
    <tr><td style="padding-top:14px;color:#6b6256;font-size:12px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">Antwoord gewoon op deze mail — het gaat rechtstreeks naar ${esc(readerName || 'de lezer')}.</td></tr>
  `)

  const toAuthor = await send({
    from: FROM,
    to: AUTHOR,
    reply_to: readerEmail,
    subject: `Vraag van ${readerName || 'een lezer'} bij hoofdstuk ${chapter}`,
    html: authorHtml,
  })

  // Confirmation to the reader — short, warm, no action needed.
  const readerHtml = shell(`
    <tr><td style="font-size:19px;font-weight:600;padding-bottom:12px;">Je vraag is aangekomen</td></tr>
    <tr><td style="font-size:16px;line-height:1.65;padding-bottom:16px;">Dank je. Ik lees hem zelf en antwoord persoonlijk — dat kan een paar dagen duren.</td></tr>
    <tr><td><blockquote style="margin:0;padding:8px 0 8px 14px;border-left:3px solid rgba(43,38,34,.18);color:#6b6256;font-size:14px;line-height:1.6;font-style:italic;">${esc(question).slice(0, 400)}</blockquote></td></tr>
  `)
  await send({
    from: FROM,
    to: readerEmail,
    subject: 'Je vraag is aangekomen',
    html: readerHtml,
  })

  return toAuthor
}

// --- lighter template: feedback + survey open text --------------------------

export async function sendNoteEmail({
  kind, readerName, readerEmail, chapter, location, total, percent, body, extra, dashboardUrl,
}) {
  const where = place({ chapter, location, total, percent })
  const title = kind === 'survey' ? 'Antwoord uit een vragenlijst' : 'Feedback van een lezer'

  const html = shell(`
    <tr><td style="font-size:13px;color:#6b6256;font-family:-apple-system,Segoe UI,Roboto,sans-serif;padding-bottom:6px;">
      ${esc(title)} — <strong style="color:#2b2622;">${esc(readerName || 'een lezer')}</strong> &lt;${esc(readerEmail)}&gt;
    </td></tr>
    ${where ? `<tr><td style="font-size:13px;color:#9b6a43;font-family:-apple-system,Segoe UI,Roboto,sans-serif;padding-bottom:16px;">${where}</td></tr>` : ''}
    ${extra ? `<tr><td style="font-size:13px;color:#6b6256;font-family:-apple-system,Segoe UI,Roboto,sans-serif;padding-bottom:14px;">${esc(extra)}</td></tr>` : ''}
    <tr><td style="font-size:16px;line-height:1.65;padding-bottom:16px;">${esc(body).replace(/\n/g, '<br>')}</td></tr>
    ${dashboardUrl ? `<tr><td style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:13px;"><a href="${esc(dashboardUrl)}" style="color:#9b6a43;">Bekijk in het dashboard</a></td></tr>` : ''}
  `)

  return send({
    from: FROM,
    to: AUTHOR,
    reply_to: readerEmail,
    subject: `${title} — ${readerName || 'lezer'}`,
    html,
  })
}
