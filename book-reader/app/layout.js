import { Lora, Playfair_Display } from 'next/font/google'
import './globals.css'

const body = Lora({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
})

const display = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  weight: ['500', '600', '700'],
  variable: '--font-display',
})

export const metadata = {
  title: 'The Book',
  description: 'A book, beautifully read.',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#f6f1e7',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable}`}>
      <body className="font-serif antialiased">{children}</body>
    </html>
  )
}
