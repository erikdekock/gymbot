'use client'
import { useEffect, useState } from 'react'

export default function Toast({ message, type = 'success', onDismiss }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    const t = setTimeout(() => {
      setVisible(false)
      setTimeout(onDismiss, 300)
    }, 3500)
    return () => clearTimeout(t)
  }, [])

  const bg = type === 'error' ? '#2a1010' : '#0f1f0f'
  const border = type === 'error' ? '#e24b4a' : '#1d9e75'
  const color = type === 'error' ? '#e24b4a' : '#1d9e75'

  return (
    <div style={{
      position: 'fixed',
      top: 56,
      left: '50%',
      transform: `translateX(-50%) translateY(${visible ? '0' : '-16px'})`,
      opacity: visible ? 1 : 0,
      transition: 'transform 0.25s ease, opacity 0.25s ease',
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: 12,
      padding: '10px 16px',
      fontSize: 14,
      color: color,
      fontWeight: 500,
      zIndex: 200,
      whiteSpace: 'nowrap',
      maxWidth: '90vw',
      boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
    }}>
      {message}
    </div>
  )
}
