import { NextResponse } from 'next/server'
import {
  DASHBOARD_PASSWORD,
  DASHBOARD_COOKIE,
  checkPassword,
  tokenFor,
} from '../../../../lib/dashboard-auth'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  if (!DASHBOARD_PASSWORD) {
    return NextResponse.json({ ok: false, error: 'no password configured' }, { status: 503 })
  }

  let body = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  if (!checkPassword(body.password || '')) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(DASHBOARD_COOKIE, tokenFor(DASHBOARD_PASSWORD), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12,
  })
  return res
}

// Lock the dashboard again.
export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(DASHBOARD_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
  return res
}
