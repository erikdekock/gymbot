'use client'
import { useRouter } from 'next/navigation'
import Wordmark from '../onboarding/_components/Wordmark'

export default function AccountDeleted() {
  const router = useRouter()

  return (
    <div className="rep-surface">
      <div className="rep-screen">
        <div className="rep-screen__top">
          <Wordmark size="small" />
          <div style={{ marginTop: 48 }}>
            <h1 className="rep-heading">Your account has been deleted.</h1>
            <p className="rep-body">
              Your account, your conversations, and your training history are gone from our systems. Nothing remains.
            </p>
            <p className="rep-helper">If you return later, you&apos;ll begin fresh.</p>
          </div>
        </div>
        <div className="rep-screen__bottom">
          <button className="rep-btn rep-btn--primary" onClick={() => router.push('/welcome')}>
            Return to start
          </button>
        </div>
      </div>
    </div>
  )
}
