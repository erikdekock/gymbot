'use client'

import { useRouter } from 'next/navigation'
import ScreenContainer from '../_components/ScreenContainer'
import Wordmark from '../_components/Wordmark'
import QuestionHeading from '../_components/QuestionHeading'
import { BodyCopy, HelperCopy } from '../_components/Typography'
import PrimaryButton from '../_components/PrimaryButton'

/**
 * Screen 0 — Welcome.
 * Spec §2 + §7. Brand mode; wordmark recedes; no question, no skip, no back.
 */
export default function WelcomePage() {
  const router = useRouter()

  return (
    <ScreenContainer
      top={
        <>
          <Wordmark size="small" />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 'var(--rep-space-3)' }}>
            <QuestionHeading>We&rsquo;ll ask a few things.</QuestionHeading>
            <BodyCopy>
              Takes about five minutes. At the end, we&rsquo;ll propose a direction and build your first week around it.
            </BodyCopy>
            <HelperCopy>
              Skip anything you&rsquo;re not ready to answer. We&rsquo;ll calibrate from your first sessions.
            </HelperCopy>
          </div>
        </>
      }
      bottom={
        <PrimaryButton onClick={() => router.push('/onboarding/history')}>
          Let&rsquo;s begin
        </PrimaryButton>
      }
    />
  )
}
