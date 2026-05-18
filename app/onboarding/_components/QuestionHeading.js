'use client'

/**
 * Primary screen heading. Editorial-weight register: IBM Plex Sans semi-bold,
 * generous breathing room. rem-based; respects Dynamic Type.
 *
 * @param {{ children: React.ReactNode, as?: 'h1'|'h2' }} props
 */
export default function QuestionHeading({ children, as = 'h1' }) {
  const Tag = as
  return <Tag className="rep-heading">{children}</Tag>
}
