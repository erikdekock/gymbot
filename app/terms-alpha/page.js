export default function TermsAlpha() {
  return (
    <div style={{
      maxWidth: 430, margin: '0 auto', padding: '64px 24px 80px',
      background: '#0a0a0a', minHeight: '100vh', color: '#f5f5f5',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
    }}>
      <p style={{ fontSize: 11, letterSpacing: '0.14em', color: '#888', marginBottom: 24 }}>GYMBOT</p>

      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 32, lineHeight: 1.2 }}>
        GymBot Alpha — Privacy Notice
      </h1>

      <p style={{ fontSize: 14, color: '#aaa', lineHeight: 1.6, marginBottom: 24 }}>
        You're one of the early users trying GymBot. This is alpha software, which means it's still being built and tested. Before you sign up, here's what you need to know.
      </p>

      <Section title="What this is">
        GymBot is a personal training app in early development. Your feedback shapes what GymBot becomes.
      </Section>

      <Section title="What we store">
        When you use GymBot, we store:
        <ul style={{ paddingLeft: 20, margin: '8px 0 0' }}>
          <li>Your email address (for login)</li>
          <li>Your training data: sessions, sets, weights, RPE scores, notes</li>
          <li>Your goals and any data you choose to enter</li>
          <li>Basic metadata: when you signed up, when you log in, when you log a session</li>
        </ul>
        <p style={{ margin: '12px 0 0' }}>
          That's it. We don't track you across other apps or websites. We don't share your data with third parties.
        </p>
      </Section>

      <Section title="Where it lives">
        Your data is stored in Supabase, a hosted database service. The GymBot admin can technically see all data — used only to improve the product, never shared externally.
      </Section>

      <Section title="How you log in">
        Login is via email magic link. Anyone with access to your email can access your GymBot account. Use a personal email address you control.
      </Section>

      <Section title="Your rights">
        <ul style={{ paddingLeft: 20, margin: '8px 0 0' }}>
          <li><strong style={{ color: '#f5f5f5' }}>You can delete your account and all training data at any time</strong> via the Profile screen. The deletion is immediate and permanent.</li>
          <li style={{ marginTop: 8 }}><strong style={{ color: '#f5f5f5' }}>You can export all your data as a JSON file</strong> via the Profile screen, anytime.</li>
          <li style={{ marginTop: 8 }}><strong style={{ color: '#f5f5f5' }}>Note on backups:</strong> GymBot keeps weekly backups. After you delete your account, your data is fully purged from backups within ~7 days.</li>
        </ul>
      </Section>

      <Section title="What &quot;alpha&quot; means">
        <ul style={{ paddingLeft: 20, margin: '8px 0 0' }}>
          <li>The app may break, be slow, or have bugs.</li>
          <li style={{ marginTop: 4 }}>Features will change as we learn what works.</li>
          <li style={{ marginTop: 4 }}>The alpha will end at some point. You'll get advance notice and a final chance to export your data.</li>
          <li style={{ marginTop: 4 }}>We may ask you for feedback. You're never required to give it.</li>
        </ul>
      </Section>

      <Section title="Questions or feedback?">
        Use the feedback button in the app. That's the support channel for now — anything you send there reaches the GymBot team directly.
      </Section>

      <p style={{ fontSize: 13, color: '#666', marginTop: 40, lineHeight: 1.5 }}>
        By tapping "I agree," you confirm you've read this and understand how GymBot uses your data during alpha.
      </p>

      <p style={{ fontSize: 11, color: '#444', marginTop: 32 }}>Last updated: 8 May 2026</p>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, color: '#f5f5f5', marginBottom: 8 }}>{title}</h2>
      <div style={{ fontSize: 14, color: '#aaa', lineHeight: 1.6 }}>{children}</div>
    </div>
  )
}
