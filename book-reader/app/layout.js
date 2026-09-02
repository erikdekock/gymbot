import { Lora, Playfair_Display, Old_Standard_TT, Neucha } from 'next/font/google'
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

// The desktop "old book" face: a revival of exactly the late-19th/early-20th
// century Russian & European book type this design is after. Cyrillic subset
// included for the pencil marginalia and the library stamp.
const bookFace = Old_Standard_TT({
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
  weight: ['400', '700'],
  variable: '--font-book',
})

// Old Standard TT only ships an italic at 400, so it's a separate face.
const bookItalic = Old_Standard_TT({
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
  weight: ['400'],
  style: ['italic'],
  variable: '--font-book-italic',
})

// Cyrillic handwriting for the pencil notes in the margin.
const handFace = Neucha({
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
  weight: ['400'],
  variable: '--font-hand',
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
    <html
      lang="en"
      className={`${body.variable} ${display.variable} ${bookFace.variable} ${bookItalic.variable} ${handFace.variable}`}
    >
      <body className="font-serif antialiased">{children}</body>
    </html>
  )
}
