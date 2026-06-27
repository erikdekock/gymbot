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
