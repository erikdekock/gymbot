'use client'

import { OnboardingProvider } from './_state/context'
import ProgressLine from './_components/ProgressLine'

export default function OnboardingLayout({ children }) {
  return (
    <OnboardingProvider>
      <div className="rep-onboarding">
        <ProgressLine />
        {children}
      </div>
    </OnboardingProvider>
  )
}
