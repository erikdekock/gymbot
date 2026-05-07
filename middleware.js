import { NextResponse } from 'next/server'

const PUBLIC_PATHS = [
  '/welcome',
  '/login',
  '/check-email',
  '/link-expired',
  '/first-login',
  '/auth/callback',
]

export function middleware(request) {
  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p))

  // Check for Supabase auth cookie
  const hasSession =
    request.cookies.get('sb-bdekeqbphmkrswcrubco-auth-token') ||
    request.cookies.get('sb-access-token') ||
    // Supabase v2 cookie names
    [...request.cookies.getAll()].some(c => c.name.includes('auth-token'))

  if (!isPublic && !hasSession) {
    return NextResponse.redirect(new URL('/welcome', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json).*)'],
}
