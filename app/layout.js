import { Big_Shoulders_Display, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'

// Reprise Design System v1.1 typefaces (locked 13 May 2026).
// Exposed as CSS variables on <html> so /onboarding (and later, all surfaces
// per 15a auth-rebrand) can reference them through tokens in globals.css.
const fontDisplay = Big_Shoulders_Display({
  subsets: ['latin'],
  weight: ['900'],
  variable: '--font-display',
  display: 'swap',
})
const fontSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-sans',
  display: 'swap',
})
const fontMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata = {
  title: 'Reprise',
  description: 'AI strength coach',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Reprise' },
  viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
}

export default function RootLayout({ children }) {
  const fontClasses = `${fontDisplay.variable} ${fontSans.variable} ${fontMono.variable}`
  return (
    <html lang="nl" className={fontClasses}>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>{children}</body>
    </html>
  )
}
