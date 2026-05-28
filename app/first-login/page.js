'use client'
import { useRouter } from 'next/navigation'
import Wordmark from '../onboarding/_components/Wordmark'

export default function FirstLogin() {
  const router = useRouter()

  return (
    <div className="rep-surface">
      <div className="rep-screen">
        <div className="rep-screen__top">
          <Wordmark size="primary" />
          <div style={{ marginTop: 48 }}>
            <h1 className="rep-heading">Welcome to Reprise.</h1>
            <p className="rep-helper">Let&apos;s set things up.</p>
          </div>
        </div>
        <div className="rep-screen__bottom">
          <button className="rep-btn rep-btn--primary" onClick={() => router.push('/')}>
            Get started
          </button>
        </div>
      </div>
    </div>
  )
}
