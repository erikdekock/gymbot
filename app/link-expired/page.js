'use client'
import { useRouter } from 'next/navigation'
import Wordmark from '../onboarding/_components/Wordmark'

export default function LinkExpired() {
  const router = useRouter()

  return (
    <div className="rep-surface">
      <div className="rep-screen">
        <div className="rep-screen__top">
          <Wordmark size="small" />
          <div style={{ marginTop: 48 }}>
            <p className="rep-input-error rep-input-error--eyebrow">Link expired</p>
            <h1 className="rep-heading">This link has expired.</h1>
            <p className="rep-helper">
              Magic links work for one hour. Want a new one?
            </p>
          </div>
        </div>
        <div className="rep-screen__bottom">
          <button className="rep-btn rep-btn--primary" onClick={() => router.push('/login')}>
            Send me a new link
          </button>
        </div>
      </div>
    </div>
  )
}
