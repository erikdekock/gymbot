# 📖 Book Reader

An Apple Books–inspired web reader for sharing your book with friends and
family — warm paper aesthetic, real page turns, no login. Each reader gets a
unique link, and a private dashboard shows you exactly how far everyone has read.

Built with **Next.js (App Router)**, **Tailwind CSS**, and **Supabase**.
Deploy-ready for **Vercel**.

---

## ✨ Features

- **Apple Books look & feel** — cream/sepia/night themes, Lora + Playfair Display
  serif typography, generous margins, soft shadows.
- **Real page turns** — true page-by-page reading (CSS multi-column), not
  infinite scroll. Smooth left/right transitions.
- **Swipe** on mobile, **arrow keys** on desktop, tap zones (left = back,
  right = forward, center = toggle the toolbar).
- **Chapter navigation** — slide-in contents sidebar.
- **Reading progress bar** at the top + page count at the bottom.
- **Font size** (small / medium / large) and **theme** toggle.
- **Picks up where you left off** — position saved in `localStorage`,
  with a "Welcome back" prompt.
- **Per-reader analytics** in Supabase — time per chapter, scroll depth,
  page views, completion, last seen — viewable on a password-gated dashboard
  with **CSV export**.

---

## 🚀 Quick start

```bash
npm install
cp .env.example .env.local   # fill in your values (see below)
npm run dev                  # http://localhost:3000
```

The reader works **without** Supabase configured — analytics simply become
no-ops, so you can preview the experience immediately.

---

## 🔧 Configuration (`.env.local`)

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
NEXT_PUBLIC_DASHBOARD_PASSWORD=choose-a-password
```

> `NEXT_PUBLIC_*` vars are exposed to the browser. The dashboard password is a
> light gate (good for a personal book), not real authentication.

---

## ✍️ Adding your book content

Chapters live in [`/content`](./content) as Markdown files, **one per chapter**.
Name them `chapter-01.md`, `chapter-02.md`, … and give each a frontmatter block:

```markdown
---
title: The Quiet Harbor
chapter_number: 1
---

# The Quiet Harbor

Your prose here. **Bold**, *italic*, > blockquotes, and `* * *` scene breaks
all work. Chapters are ordered by `chapter_number`.
```

Two placeholder chapters are included so the app works out of the box — just
replace them with your own. Add as many chapters as you like; they're picked up
automatically (sorted by `chapter_number`).

To change the book/author title, edit `bookTitle` in
[`app/read/page.js`](./app/read/page.js) and the cover text in
[`app/page.js`](./app/page.js).

---

## 🔗 Generating reader links

Each reader is identified by a unique id in their URL:

```
https://your-app.com/read?id=UNIQUEID
```

Three ways to create one:

1. **Dashboard** → **"New reader link"** generates an id and copies the link.
2. **Auto** — anyone who opens `/read` with no id gets a fresh id assigned and
   written into their URL automatically (so the link they bookmark is theirs).
3. **By hand** — append any unique string, e.g. `/read?id=grandma`.

Share a distinct link per person and the dashboard attributes all reading
activity to them.

---

## 🗄️ Setting up Supabase (analytics)

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste the contents of
   [`supabase/schema.sql`](./supabase/schema.sql), and **Run**. This creates the
   `readers` and `chapter_stats` tables, the analytics functions, and the
   row-level-security policies.
3. From **Settings → API**, copy the **Project URL** and **anon public key**
   into your `.env.local`.

That's it — reading activity now flows into Supabase.

### What gets tracked

| Where | Field | Meaning |
|-------|-------|---------|
| `readers` | `name`, `email` | Entered (optionally) in the welcome modal |
| `readers` | `progress_pct` | % of the whole book completed |
| `readers` | `finished` | Reached the last page of the last chapter |
| `readers` | `last_seen_at` | Most recent activity |
| `chapter_stats` | `time_spent_seconds` | Time spent per chapter |
| `chapter_stats` | `max_scroll_pct` | Deepest point reached in a chapter |
| `chapter_stats` | `page_views` | Page turns within a chapter |
| `chapter_stats` | `views` | Times the chapter was opened |

---

## 📊 Viewing the dashboard

Visit **`/dashboard`**, enter `NEXT_PUBLIC_DASHBOARD_PASSWORD`, and you'll see:

- A table of every reader: name/email, progress %, total time, chapters
  started, last seen, finished.
- Click a reader for their **chapter-by-chapter journey** (time, scroll depth,
  visits, page turns per chapter) and their personal link.
- **Export CSV** for the whole table.

---

## ☁️ Deploying to Vercel

1. Push this repo to GitHub.
2. Import it at [vercel.com/new](https://vercel.com/new).
3. Add the three environment variables from `.env.local` in
   **Project Settings → Environment Variables**.
4. Deploy. Share your `/read?id=…` links and watch the dashboard.

---

## 🗂️ Project structure

```
app/
  page.js            Cover / landing
  read/page.js       The reader (loads chapters, renders <Reader/>)
  dashboard/page.js  Password-gated analytics dashboard
  layout.js          Fonts + root layout
  globals.css        Theme palettes + reading typography
components/
  Reader.js          Page-turn engine, gestures, analytics wiring
  Toolbar.js         Top chrome: contents, font size, theme
  ChapterNav.js      Slide-in contents sidebar
  ProgressBar.js     Top progress bar
  WelcomeModal.js    "Who are you? (optional)" first-visit modal
lib/
  content.js         Reads /content markdown on the server
  markdown.js        Tiny Markdown + frontmatter parser (no deps)
  supabase.js        Browser Supabase client
  analytics.js       trackChapter / updateProgress / registerReader
  reader-id.js       Unique id + localStorage position/preferences
content/
  chapter-01.md      Placeholder chapter
  chapter-02.md      Placeholder chapter
supabase/
  schema.sql         Tables, functions, RLS policies
```

---

## ⌨️ Reader controls

| Action | Control |
|--------|---------|
| Next page | → / Space / swipe left / tap right edge / arrow button |
| Previous page | ← / Shift+Space / swipe right / tap left edge / arrow button |
| Show/hide toolbar | Tap the center of the page |
| Contents | Toolbar ☰ button |
| Font size / theme | Toolbar **Aa** button |
```

---

# 🚀 Going live

Everything below is one-time setup. Do it in this order.

## 1. Supabase — database

1. **SQL Editor → New query** → paste all of `supabase/schema.sql` → **Run**.
   It is idempotent: safe to run again on an existing database, and it never
   drops reader data.
2. Confirm the security pass took effect:
   ```bash
   node scripts/verify-anon-access.mjs
   ```
   This must print **PASS**. If any table reports `LEAKED`, the schema didn't
   fully apply — re-run it.

## 2. Supabase — auth

**Authentication → URL Configuration**

| Setting | Value |
| --- | --- |
| Site URL | `https://your-domain.nl` |
| Redirect URLs | `https://your-domain.nl/auth/callback` |
| | `http://localhost:3000/auth/callback` (for local dev) |

**Authentication → Providers → Email**
- Enable **Email**.
- Turn **Confirm email** ON.
- Turn **Enable email provider sign-up** ON (readers create an account by
  simply asking for a link).
- You can leave passwords disabled entirely — the app never uses them.

**Authentication → Email Templates → Magic Link**
- Subject: `Je leeslink voor Het Zal`
- Body: paste `supabase/email-templates/magic-link.html`.
  Keep `{{ .ConfirmationURL }}` exactly as it is.

**Authentication → Rate Limits** (Supabase's built-in defaults are low)
- *Emails per hour*: raise from 4 to something like **100** once custom SMTP is
  configured — the default only applies to Supabase's shared mailer.
- *Token verifications per hour*: 30 is fine.
- *Sign-ups per hour*: 30 is fine for a private book.

## 3. Resend — sending mail

### Custom SMTP for the magic link
**Supabase → Project Settings → Authentication → SMTP Settings → Enable Custom SMTP**

| Field | Value |
| --- | --- |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | your Resend API key (`re_…`) |
| Sender email | `post@hetzal.nl` (must be on a verified domain) |
| Sender name | `Het Zal` |

Without this, Supabase sends magic links from its own shared domain and will
throttle you at a handful of emails per hour.

### DNS records at your registrar
Resend → **Domains → Add domain → `hetzal.nl`**, then add the records it shows.
They look like this (copy the exact values from Resend, not from here):

| Type | Name | Value |
| --- | --- | --- |
| MX | `send` | `feedback-smtp.eu-west-1.amazonses.com` (priority 10) |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` |
| TXT | `resend._domainkey` | the long DKIM key Resend gives you |
| TXT | `_dmarc` | `v=DMARC1; p=none;` |

Wait for Resend to show **Verified** before going live.

## 4. Vercel — environment variables

Set these on the project whose **Root Directory is `book-reader`**:

| Variable | Scope | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | all | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | all | the publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | all | **server-only.** Never `NEXT_PUBLIC_`. |
| `DASHBOARD_PASSWORD` | all | gate for `/dashboard` |
| `RESEND_API_KEY` | all | `re_…` |
| `AUTHOR_EMAIL` | all | where reader questions arrive |
| `MAIL_FROM` | all | e.g. `Het Zal <post@hetzal.nl>` |

Redeploy after adding them — Next.js inlines `NEXT_PUBLIC_*` at build time.

## 5. Check it end to end

1. Open `/`, enter your email, click the link in the mail → you land on `/read`.
2. Read a few pages, close the tab, open `/read` on your phone → same place.
3. Select a sentence → **Stel een vraag** → the mail arrives at `AUTHOR_EMAIL`
   and **Reply** goes to the reader.
4. Finish a chapter → the survey card appears (once per chapter).
5. Open `/dashboard`, enter the password → Vragen and Antwoorden are populated.

---

## 🔐 How the data is protected

- The **public key can read nothing.** Every table has RLS; there are no `anon`
  policies left. `scripts/verify-anon-access.mjs` proves it.
- Readers can only ever touch their own rows (`user_id = auth.uid()`), and the
  write RPCs take their identity from `auth.uid()` — a reader cannot write as
  someone else even by passing a different id.
- The **dashboard never uses a browser key.** It calls
  `/api/dashboard/data`, which reads with the service-role key on the server,
  behind an **httpOnly** password cookie.
- Only **country and city** are stored for location, taken from Vercel's edge
  headers. The raw IP is never read or written.
- Analytics are **opt-in**: nothing is pre-ticked, and declining stops the
  event stream. **Vergeet mij** deletes the auth user and cascades every row.
