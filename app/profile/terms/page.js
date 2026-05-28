'use client'
import { useRouter } from 'next/navigation'
import Wordmark from '../../onboarding/_components/Wordmark'

export default function TermsPrivacyAbout() {
  const router = useRouter()

  return (
    <div className="rep-surface">
      <div className="rep-screen">
        <div className="rep-screen__top" style={{ overflow: 'hidden' }}>
          <button className="rep-back" onClick={() => router.back()}>
            ← Back
          </button>
          <Wordmark size="small" />
          <h1 className="rep-heading" style={{ marginTop: 16 }}>
            Terms &amp; privacy
          </h1>

          <div className="rep-reading">
            <p className="rep-reading__lead">
              These are alpha concept terms, written in plain language to set
              expectations during early access. They will be replaced with formal
              legal copy before public release.
            </p>

            <h4>You&apos;re in early</h4>
            <p>
              Reprise is alpha software. It may break, be slow, or change without
              notice. Features will come and go as we learn what works. The alpha
              will end at some point — you&apos;ll get advance notice and a final
              chance to export your data.
            </p>

            <h4>Your data</h4>
            <p>
              We store your email (for login), your training data (sessions, sets,
              weights, RPE, notes), and basic metadata (sign-up date, login times).
              Nothing else. We don&apos;t track you across other apps, and we
              don&apos;t share your data with third parties.
            </p>
            <p>
              Data lives in Supabase, a hosted database. The Reprise admin can
              technically see it — used only to improve the product, never shared.
              You can <strong>delete your account and all training data</strong> at
              any time from the profile screen. Deletion is immediate; backups are
              purged within roughly seven days. You can{' '}
              <strong>export everything as JSON</strong> any time.
            </p>

            <h4>Communication</h4>
            <p>
              Login is by magic link sent to your email. Anyone with access to your
              inbox can access your Reprise account — use a personal email you
              control. Feedback goes through the in-app feedback button; that&apos;s
              the support channel for now, and anything you send reaches the team
              directly. We don&apos;t send marketing email.
            </p>

            <h4>No medical advice</h4>
            <p>
              Reprise is a training app, not a medical service. Nothing it suggests
              is medical advice. If you have a clinical condition, an injury, or
              any concern that calls for a professional, see one. Reprise is
              designed to defer to you on safety.
            </p>

            <h4>Training at your own risk</h4>
            <p>
              You&apos;re responsible for your own training decisions. Listen to
              your body. Stop if something hurts. Reprise can&apos;t be held liable
              for injury, data loss, downtime, or other issues during alpha.
              That&apos;s the deal for being here early.
            </p>
          </div>

          <p className="rep-helper" style={{ marginTop: 16 }}>
            Reprise · Version {process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0-alpha'}
            {' · '}Last updated May 2026.
          </p>
        </div>
      </div>
    </div>
  )
}
