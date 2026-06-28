-- ===========================================================================
--  Book Reader — Supabase schema
--  Run this in your Supabase project: SQL Editor → New query → paste → Run.
-- ===========================================================================

-- One row per reader (identified by the unique id in their ?id= link).
create table if not exists public.readers (
  id              text primary key,
  name            text,
  email           text,
  progress_pct    int  not null default 0,
  current_chapter int  not null default 1,
  current_page    int  not null default 0,
  finished        boolean not null default false,
  finished_at     timestamptz,
  created_at      timestamptz not null default now(),
  last_seen_at    timestamptz not null default now()
);

-- Per-reader, per-chapter aggregated analytics.
create table if not exists public.chapter_stats (
  reader_id          text not null references public.readers(id) on delete cascade,
  chapter_number     int  not null,
  chapter_title      text,
  time_spent_seconds int  not null default 0,
  max_scroll_pct     int  not null default 0,
  page_views         int  not null default 0,
  views              int  not null default 0,
  first_seen_at      timestamptz not null default now(),
  last_seen_at       timestamptz not null default now(),
  primary key (reader_id, chapter_number)
);

-- ---------------------------------------------------------------------------
--  RPC functions. SECURITY DEFINER so the public anon key can record analytics
--  through these controlled entry points without table-level write access.
-- ---------------------------------------------------------------------------

-- Create/update a reader, optionally attaching a name/email.
create or replace function public.register_reader(p_id text, p_name text, p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.readers (id, name, email)
  values (p_id, nullif(p_name, ''), nullif(p_email, ''))
  on conflict (id) do update set
    name         = coalesce(nullif(excluded.name, ''), public.readers.name),
    email        = coalesce(nullif(excluded.email, ''), public.readers.email),
    last_seen_at = now();
end;
$$;

-- Accumulate time/scroll/page-views/visits for one chapter, atomically.
create or replace function public.track_chapter(
  p_reader_id text,
  p_chapter   int,
  p_title     text,
  p_seconds   int,
  p_scroll    int,
  p_pages     int,
  p_is_view   boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.readers (id) values (p_reader_id)
  on conflict (id) do nothing;

  update public.readers set last_seen_at = now() where id = p_reader_id;

  insert into public.chapter_stats (
    reader_id, chapter_number, chapter_title,
    time_spent_seconds, max_scroll_pct, page_views, views
  )
  values (
    p_reader_id, p_chapter, p_title,
    greatest(p_seconds, 0), greatest(p_scroll, 0), greatest(p_pages, 0),
    case when p_is_view then 1 else 0 end
  )
  on conflict (reader_id, chapter_number) do update set
    chapter_title      = coalesce(excluded.chapter_title, public.chapter_stats.chapter_title),
    time_spent_seconds = public.chapter_stats.time_spent_seconds + greatest(p_seconds, 0),
    max_scroll_pct     = greatest(public.chapter_stats.max_scroll_pct, greatest(p_scroll, 0)),
    page_views         = public.chapter_stats.page_views + greatest(p_pages, 0),
    views              = public.chapter_stats.views + case when p_is_view then 1 else 0 end,
    last_seen_at       = now();
end;
$$;

-- Update the reader's overall progress + finished flag.
create or replace function public.update_progress(
  p_reader_id text,
  p_pct       int,
  p_chapter   int,
  p_page      int,
  p_finished  boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.readers (id) values (p_reader_id)
  on conflict (id) do nothing;

  update public.readers set
    progress_pct    = greatest(progress_pct, p_pct),
    current_chapter = p_chapter,
    current_page    = p_page,
    finished        = finished or p_finished,
    finished_at     = case
                        when (finished or p_finished) and finished_at is null then now()
                        else finished_at
                      end,
    last_seen_at    = now()
  where id = p_reader_id;
end;
$$;

-- ---------------------------------------------------------------------------
--  Row Level Security.
--  Writes happen only through the SECURITY DEFINER functions above.
--  The dashboard reads tables directly with the anon key, so we allow SELECT.
--  (The dashboard itself is password-gated in the UI.)
-- ---------------------------------------------------------------------------
alter table public.readers       enable row level security;
alter table public.chapter_stats enable row level security;

drop policy if exists "anon read readers" on public.readers;
create policy "anon read readers" on public.readers
  for select to anon using (true);

drop policy if exists "anon read chapter_stats" on public.chapter_stats;
create policy "anon read chapter_stats" on public.chapter_stats
  for select to anon using (true);

grant execute on function public.register_reader(text, text, text) to anon;
grant execute on function public.track_chapter(text, int, text, int, int, int, boolean) to anon;
grant execute on function public.update_progress(text, int, int, int, boolean) to anon;

-- ===========================================================================
--  FANBASE COMMAND CENTER  (additive — safe to run on an existing database)
--  Highlights/comments/likes, general feedback, Het Zal opt-ins, sharing &
--  referrals. Everything follows the same SECURITY DEFINER + anon-grant pattern
--  as above, so the public anon key can only write through controlled RPCs.
-- ===========================================================================

-- Who invited this reader (the ?ref= reader id on their first visit).
alter table public.readers add column if not exists referred_by text;

-- Highlights, inline comments and likes a reader leaves on a passage.
create table if not exists public.annotations (
  id             uuid primary key default gen_random_uuid(),
  reader_id      text not null references public.readers(id) on delete cascade,
  chapter_number int  not null,
  chapter_title  text,
  kind           text not null check (kind in ('highlight', 'comment', 'like')),
  passage        text,                 -- the highlighted / liked sentence(s)
  note           text,                 -- the reader's comment, when kind='comment'
  created_at     timestamptz not null default now()
);
create index if not exists annotations_reader_idx  on public.annotations(reader_id);
create index if not exists annotations_chapter_idx on public.annotations(chapter_number);

-- Free-form feedback ("what did you think of the book?").
create table if not exists public.feedback (
  id         uuid primary key default gen_random_uuid(),
  reader_id  text references public.readers(id) on delete cascade,
  rating     int,                       -- optional 1–5
  message    text not null,
  created_at timestamptz not null default now()
);
create index if not exists feedback_reader_idx on public.feedback(reader_id);

-- Het Zal email opt-ins (one row per reader who subscribed).
create table if not exists public.subscribers (
  reader_id     text primary key references public.readers(id) on delete cascade,
  email         text,
  name          text,
  book_title    text,
  source        text default 'het-zal',
  subscribed_at timestamptz not null default now()
);

-- Share events (a reader sharing their link). Referral *reach* is derived from
-- readers.referred_by; this table records the share action itself.
create table if not exists public.shares (
  id         uuid primary key default gen_random_uuid(),
  reader_id  text references public.readers(id) on delete cascade,
  channel    text,                      -- 'copy', 'whatsapp', 'email', …
  created_at timestamptz not null default now()
);
create index if not exists shares_reader_idx on public.shares(reader_id);

-- ---------------------------------------------------------------------------
--  Write RPCs (SECURITY DEFINER). Each makes sure the reader row exists first.
-- ---------------------------------------------------------------------------

-- Record who referred a reader — once only, never self-referential.
create or replace function public.set_referrer(p_reader_id text, p_ref text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_ref is null or p_ref = '' or p_ref = p_reader_id then return; end if;
  insert into public.readers (id) values (p_reader_id) on conflict (id) do nothing;
  update public.readers
     set referred_by = p_ref
   where id = p_reader_id and referred_by is null;
end;
$$;

-- Add a highlight / comment / like.
create or replace function public.add_annotation(
  p_reader_id text, p_chapter int, p_title text,
  p_kind text, p_passage text, p_note text
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_kind not in ('highlight', 'comment', 'like') then return; end if;
  insert into public.readers (id) values (p_reader_id) on conflict (id) do nothing;
  update public.readers set last_seen_at = now() where id = p_reader_id;
  insert into public.annotations (reader_id, chapter_number, chapter_title, kind, passage, note)
  values (p_reader_id, p_chapter, p_title, p_kind, nullif(p_passage, ''), nullif(p_note, ''));
end;
$$;

-- Leave general feedback.
create or replace function public.add_feedback(p_reader_id text, p_rating int, p_message text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_message is null or p_message = '' then return; end if;
  insert into public.readers (id) values (p_reader_id) on conflict (id) do nothing;
  update public.readers set last_seen_at = now() where id = p_reader_id;
  insert into public.feedback (reader_id, rating, message)
  values (p_reader_id, p_rating, p_message);
end;
$$;

-- Subscribe to Het Zal. Also backfills the reader's email/name if given.
create or replace function public.subscribe_hetzal(
  p_reader_id text, p_email text, p_name text, p_book text
)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.readers (id, email, name)
  values (p_reader_id, nullif(p_email, ''), nullif(p_name, ''))
  on conflict (id) do update set
    email        = coalesce(public.readers.email, nullif(excluded.email, '')),
    name         = coalesce(public.readers.name,  nullif(excluded.name, '')),
    last_seen_at = now();

  insert into public.subscribers (reader_id, email, name, book_title)
  values (p_reader_id, nullif(p_email, ''), nullif(p_name, ''), nullif(p_book, ''))
  on conflict (reader_id) do update set
    email      = coalesce(nullif(excluded.email, ''), public.subscribers.email),
    name       = coalesce(nullif(excluded.name, ''),  public.subscribers.name),
    book_title = coalesce(nullif(excluded.book_title, ''), public.subscribers.book_title);
end;
$$;

-- Record a share action.
create or replace function public.record_share(p_reader_id text, p_channel text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.readers (id) values (p_reader_id) on conflict (id) do nothing;
  update public.readers set last_seen_at = now() where id = p_reader_id;
  insert into public.shares (reader_id, channel) values (p_reader_id, nullif(p_channel, ''));
end;
$$;

-- ---------------------------------------------------------------------------
--  Optional read-side aggregation helpers (SECURITY DEFINER, read-only).
--  The dashboard computes everything client-side from the raw tables, so these
--  are conveniences for power users / your own SQL — the UI does not require
--  them. They mirror the heat-map, retention and growth views.
-- ---------------------------------------------------------------------------

-- Per-chapter engagement: readers reached, highlights/likes/comments, avg time.
create or replace function public.chapter_insights()
returns table (
  chapter_number  int,
  chapter_title   text,
  readers_reached bigint,
  avg_seconds     numeric,
  highlights      bigint,
  likes           bigint,
  comments        bigint
)
language sql security definer set search_path = public as $$
  with chapters as (
    select chapter_number, max(chapter_title) as chapter_title from public.chapter_stats group by chapter_number
    union
    select chapter_number, max(chapter_title) from public.annotations group by chapter_number
  )
  select
    c.chapter_number,
    c.chapter_title,
    coalesce((select count(*) from public.chapter_stats s where s.chapter_number = c.chapter_number), 0),
    coalesce((select avg(s.time_spent_seconds) from public.chapter_stats s where s.chapter_number = c.chapter_number), 0),
    coalesce((select count(*) from public.annotations a where a.chapter_number = c.chapter_number and a.kind = 'highlight'), 0),
    coalesce((select count(*) from public.annotations a where a.chapter_number = c.chapter_number and a.kind = 'like'), 0),
    coalesce((select count(*) from public.annotations a where a.chapter_number = c.chapter_number and a.kind = 'comment'), 0)
  from chapters c
  order by c.chapter_number;
$$;

-- Retention: how many readers reached at least each chapter.
create or replace function public.retention_curve()
returns table (chapter_number int, readers_reached bigint)
language sql security definer set search_path = public as $$
  with reached as (
    select id, greatest(
      coalesce(current_chapter, 1),
      coalesce((select max(chapter_number) from public.chapter_stats s where s.reader_id = r.id), 1)
    ) as max_chapter
    from public.readers r
  ),
  chapters as (select distinct chapter_number from public.chapter_stats)
  select c.chapter_number, (select count(*) from reached where max_chapter >= c.chapter_number)
  from chapters c order by c.chapter_number;
$$;

-- New readers and new subscribers per ISO week.
create or replace function public.weekly_growth()
returns table (week date, new_readers bigint, new_subscribers bigint)
language sql security definer set search_path = public as $$
  with weeks as (
    select date_trunc('week', created_at)::date as week from public.readers
    union
    select date_trunc('week', subscribed_at)::date from public.subscribers
  )
  select
    w.week,
    coalesce((select count(*) from public.readers r where date_trunc('week', r.created_at)::date = w.week), 0),
    coalesce((select count(*) from public.subscribers s where date_trunc('week', s.subscribed_at)::date = w.week), 0)
  from weeks w order by w.week;
$$;

-- ---------------------------------------------------------------------------
--  RLS + grants for the new tables (read with anon key; write via RPCs only).
-- ---------------------------------------------------------------------------
alter table public.annotations enable row level security;
alter table public.feedback    enable row level security;
alter table public.subscribers enable row level security;
alter table public.shares      enable row level security;

drop policy if exists "anon read annotations" on public.annotations;
create policy "anon read annotations" on public.annotations for select to anon using (true);
drop policy if exists "anon read feedback" on public.feedback;
create policy "anon read feedback" on public.feedback for select to anon using (true);
drop policy if exists "anon read subscribers" on public.subscribers;
create policy "anon read subscribers" on public.subscribers for select to anon using (true);
drop policy if exists "anon read shares" on public.shares;
create policy "anon read shares" on public.shares for select to anon using (true);

grant execute on function public.set_referrer(text, text) to anon;
grant execute on function public.add_annotation(text, int, text, text, text, text) to anon;
grant execute on function public.add_feedback(text, int, text) to anon;
grant execute on function public.subscribe_hetzal(text, text, text, text) to anon;
grant execute on function public.record_share(text, text) to anon;
grant execute on function public.chapter_insights() to anon;
grant execute on function public.retention_curve() to anon;
grant execute on function public.weekly_growth() to anon;
