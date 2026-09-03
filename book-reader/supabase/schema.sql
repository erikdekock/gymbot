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

-- ###########################################################################
--  MIGRATION 2 — READER IDENTITY, CDP, DIALOGUE
--
--  Safe to run on an existing database: every statement is idempotent, and
--  nothing here drops reader data. Run the whole file top to bottom.
--
--  Identity change: readers.id is now the Supabase auth user id (as text).
--  Pre-account rows keyed by the old localStorage id are adopted on first
--  login via claim_legacy_reader().
--
--  SECURITY MODEL (changed):
--    * The anon key can no longer SELECT anything. All previous
--      "anon read ..." policies are dropped below.
--    * Readers may read and write only their own rows (user_id = auth.uid()).
--    * Writes still go through SECURITY DEFINER functions, but those now take
--      their identity from auth.uid() and ignore any id passed by the client,
--      so one reader can never write as another.
--    * The dashboard reads with the service-role key from server-side route
--      handlers only (never the browser).
-- ###########################################################################

-- --------------------------------------------------------------------------
--  1. Reader profile + derived fields
-- --------------------------------------------------------------------------
alter table public.readers add column if not exists first_name           text;
alter table public.readers add column if not exists last_name            text;
alter table public.readers add column if not exists current_paragraph    int  not null default 0;
alter table public.readers add column if not exists current_location     int  not null default 1;
alter table public.readers add column if not exists furthest_location    int  not null default 0;
alter table public.readers add column if not exists total_reading_seconds int not null default 0;
alter table public.readers add column if not exists session_count        int  not null default 0;
alter table public.readers add column if not exists median_page_dwell    int  not null default 0;
-- NULL = not asked yet. Never defaulted to true: consent is opt-in.
alter table public.readers add column if not exists analytics_consent    boolean;
alter table public.readers add column if not exists consent_at           timestamptz;

-- --------------------------------------------------------------------------
--  2. Events — the append-only behavioural stream
-- --------------------------------------------------------------------------
create table if not exists public.events (
  id             bigserial primary key,
  user_id        uuid not null references auth.users(id) on delete cascade,
  session_id     text,
  event_type     text not null,
  chapter_number int,
  location       int,
  payload        jsonb not null default '{}'::jsonb,
  occurred_at    timestamptz not null default now(),
  -- session context, captured once per session and stamped on its events
  device_type    text,
  os             text,
  browser        text,
  screen_w       int,
  screen_h       int,
  viewport_w     int,
  viewport_h     int,
  language       text,
  timezone       text,
  referrer       text,
  utm_source     text,
  utm_medium     text,
  utm_campaign   text,
  country        text,   -- coarse geo only; the raw IP is never stored
  city           text
);
create index if not exists events_user_time_idx on public.events (user_id, occurred_at desc);
create index if not exists events_type_idx      on public.events (event_type);
create index if not exists events_location_idx  on public.events (location);
create index if not exists events_session_idx   on public.events (session_id);

-- --------------------------------------------------------------------------
--  3. Questions, surveys, and feedback upgrades
-- --------------------------------------------------------------------------
create table if not exists public.questions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  chapter_number  int,
  location        int,
  paragraph_index int,
  char_start      int,
  char_end        int,
  selected_text   text,
  question        text not null,
  status          text not null default 'open' check (status in ('open', 'answered')),
  answered_at     timestamptz,
  email_failed    boolean not null default false,
  email_error     text,
  created_at      timestamptz not null default now()
);
create index if not exists questions_user_idx   on public.questions (user_id, created_at desc);
create index if not exists questions_status_idx on public.questions (status);

create table if not exists public.survey_responses (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  chapter_number int not null,
  kind           text not null default 'chapter',
  answers        jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  unique (user_id, chapter_number)
);
create index if not exists survey_chapter_idx on public.survey_responses (chapter_number);

-- feedback gains an auth owner + a place in the book
alter table public.feedback add column if not exists user_id        uuid references auth.users(id) on delete cascade;
alter table public.feedback add column if not exists chapter_number int;
alter table public.feedback add column if not exists location       int;
alter table public.feedback add column if not exists selected_text  text;
alter table public.feedback add column if not exists email_failed   boolean not null default false;
alter table public.feedback add column if not exists email_error    text;

-- annotations gain the exact anchor so a highlight can be re-found
alter table public.annotations add column if not exists user_id         uuid references auth.users(id) on delete cascade;
alter table public.annotations add column if not exists location        int;
alter table public.annotations add column if not exists paragraph_index int;
alter table public.annotations add column if not exists char_start      int;
alter table public.annotations add column if not exists char_end        int;

-- --------------------------------------------------------------------------
--  4. RPCs. All of these now derive identity from auth.uid() and IGNORE any
--     id passed by the client, so a reader can only ever write as themselves.
-- --------------------------------------------------------------------------

-- Make sure the signed-in reader has a row; optionally set name/email.
create or replace function public.ensure_reader(p_first_name text, p_last_name text, p_email text)
returns void language plpgsql security definer set search_path = public as $$
declare uid text := auth.uid()::text;
begin
  if uid is null then return; end if;
  insert into public.readers (id, first_name, last_name, email, name)
  values (uid, nullif(p_first_name,''), nullif(p_last_name,''), nullif(p_email,''),
          nullif(trim(coalesce(p_first_name,'') || ' ' || coalesce(p_last_name,'')), ''))
  on conflict (id) do update set
    first_name   = coalesce(nullif(excluded.first_name,''), public.readers.first_name),
    last_name    = coalesce(nullif(excluded.last_name,''),  public.readers.last_name),
    email        = coalesce(nullif(excluded.email,''),      public.readers.email),
    name         = coalesce(nullif(excluded.name,''),       public.readers.name),
    last_seen_at = now();
end;
$$;

create or replace function public.set_analytics_consent(p_consent boolean)
returns void language plpgsql security definer set search_path = public as $$
declare uid text := auth.uid()::text;
begin
  if uid is null then return; end if;
  insert into public.readers (id) values (uid) on conflict (id) do nothing;
  update public.readers
     set analytics_consent = p_consent, consent_at = now()
   where id = uid;
end;
$$;

-- Store the reading position as a STABLE anchor (chapter + paragraph +
-- location). Never a page number — pages depend on the device.
create or replace function public.save_position(
  p_chapter int, p_paragraph int, p_location int, p_pct int, p_finished boolean
)
returns void language plpgsql security definer set search_path = public as $$
declare uid text := auth.uid()::text;
begin
  if uid is null then return; end if;
  insert into public.readers (id) values (uid) on conflict (id) do nothing;
  update public.readers set
    current_chapter   = coalesce(p_chapter, current_chapter),
    current_paragraph = greatest(coalesce(p_paragraph, 0), 0),
    current_location  = greatest(coalesce(p_location, 1), 1),
    furthest_location = greatest(furthest_location, coalesce(p_location, 1)),
    progress_pct      = greatest(progress_pct, coalesce(p_pct, 0)),
    finished          = finished or coalesce(p_finished, false),
    finished_at       = case when (finished or coalesce(p_finished,false)) and finished_at is null
                             then now() else finished_at end,
    last_seen_at      = now()
  where id = uid;
end;
$$;

-- Adopt rows written before this browser had an account.
create or replace function public.claim_legacy_reader(p_legacy_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid text := auth.uid()::text;
  moved jsonb := '{}'::jsonb;
begin
  if uid is null or p_legacy_id is null or p_legacy_id = uid then
    return moved;
  end if;
  if not exists (select 1 from public.readers where id = p_legacy_id) then
    return moved;
  end if;

  insert into public.readers (id) values (uid) on conflict (id) do nothing;

  -- chapter_stats has a composite PK, so merge rather than move.
  insert into public.chapter_stats as cs
    (reader_id, chapter_number, chapter_title, time_spent_seconds, max_scroll_pct, page_views, views)
  select uid, chapter_number, chapter_title, time_spent_seconds, max_scroll_pct, page_views, views
    from public.chapter_stats where reader_id = p_legacy_id
  on conflict (reader_id, chapter_number) do update set
    time_spent_seconds = cs.time_spent_seconds + excluded.time_spent_seconds,
    max_scroll_pct     = greatest(cs.max_scroll_pct, excluded.max_scroll_pct),
    page_views         = cs.page_views + excluded.page_views,
    views              = cs.views + excluded.views,
    last_seen_at       = now();
  delete from public.chapter_stats where reader_id = p_legacy_id;

  update public.annotations set reader_id = uid, user_id = auth.uid() where reader_id = p_legacy_id;
  update public.feedback    set reader_id = uid, user_id = auth.uid() where reader_id = p_legacy_id;
  update public.shares      set reader_id = uid where reader_id = p_legacy_id;
  update public.readers     set referred_by = uid where referred_by = p_legacy_id;

  -- Carry the furthest progress across, then retire the legacy row.
  update public.readers r set
    progress_pct      = greatest(r.progress_pct, l.progress_pct),
    furthest_location = greatest(r.furthest_location, l.furthest_location),
    finished          = r.finished or l.finished,
    name              = coalesce(r.name, l.name),
    email             = coalesce(r.email, l.email)
  from public.readers l
  where r.id = uid and l.id = p_legacy_id;

  delete from public.subscribers where reader_id = p_legacy_id;
  delete from public.readers where id = p_legacy_id;

  return jsonb_build_object('claimed', p_legacy_id);
end;
$$;

-- Derived per-reader fields, recomputed from the event stream.
create or replace function public.refresh_reader_derived(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid text;
begin
  -- Only ever refresh your own row unless called by the service role.
  if auth.uid() is not null and p_user_id <> auth.uid() then return; end if;
  uid := p_user_id::text;

  insert into public.readers (id) values (uid) on conflict (id) do nothing;

  update public.readers r set
    furthest_location = greatest(r.furthest_location, coalesce(agg.max_loc, 0)),
    total_reading_seconds = coalesce(agg.seconds, 0),
    session_count     = coalesce(agg.sessions, 0),
    median_page_dwell = coalesce(agg.median_dwell, 0)
  from (
    select
      max(e.location)                                              as max_loc,
      sum(case when e.event_type = 'page_dwell'
               then coalesce((e.payload->>'seconds')::int, 0) else 0 end) as seconds,
      count(distinct e.session_id)                                 as sessions,
      percentile_cont(0.5) within group (
        order by case when e.event_type = 'page_dwell'
                      then coalesce((e.payload->>'seconds')::int, 0) end
      )                                                            as median_dwell
    from public.events e
    where e.user_id = p_user_id
  ) agg
  where r.id = uid;
end;
$$;

-- --------------------------------------------------------------------------
--  5. Harden the legacy write RPCs.
--     Same signatures (the client still passes an id) but the id is now
--     ignored: identity comes from auth.uid(). Execute is revoked from anon.
-- --------------------------------------------------------------------------
create or replace function public.register_reader(p_id text, p_name text, p_email text)
returns void language plpgsql security definer set search_path = public as $$
declare uid text := auth.uid()::text;
begin
  if uid is null then return; end if;
  insert into public.readers (id, name, email)
  values (uid, nullif(p_name, ''), nullif(p_email, ''))
  on conflict (id) do update set
    name         = coalesce(nullif(excluded.name, ''), public.readers.name),
    email        = coalesce(nullif(excluded.email, ''), public.readers.email),
    last_seen_at = now();
end;
$$;

create or replace function public.track_chapter(
  p_reader_id text, p_chapter int, p_title text,
  p_seconds int, p_scroll int, p_pages int, p_is_view boolean
)
returns void language plpgsql security definer set search_path = public as $$
declare uid text := auth.uid()::text;
begin
  if uid is null then return; end if;
  insert into public.readers (id) values (uid) on conflict (id) do nothing;
  update public.readers set last_seen_at = now() where id = uid;

  insert into public.chapter_stats (
    reader_id, chapter_number, chapter_title,
    time_spent_seconds, max_scroll_pct, page_views, views
  )
  values (uid, p_chapter, p_title,
          greatest(p_seconds,0), greatest(p_scroll,0), greatest(p_pages,0),
          case when p_is_view then 1 else 0 end)
  on conflict (reader_id, chapter_number) do update set
    chapter_title      = coalesce(excluded.chapter_title, public.chapter_stats.chapter_title),
    time_spent_seconds = public.chapter_stats.time_spent_seconds + greatest(p_seconds,0),
    max_scroll_pct     = greatest(public.chapter_stats.max_scroll_pct, greatest(p_scroll,0)),
    page_views         = public.chapter_stats.page_views + greatest(p_pages,0),
    views              = public.chapter_stats.views + case when p_is_view then 1 else 0 end,
    last_seen_at       = now();
end;
$$;

create or replace function public.update_progress(
  p_reader_id text, p_pct int, p_chapter int, p_page int, p_finished boolean
)
returns void language plpgsql security definer set search_path = public as $$
declare uid text := auth.uid()::text;
begin
  if uid is null then return; end if;
  insert into public.readers (id) values (uid) on conflict (id) do nothing;
  update public.readers set
    progress_pct    = greatest(progress_pct, p_pct),
    current_chapter = p_chapter,
    current_page    = p_page,
    finished        = finished or p_finished,
    finished_at     = case when (finished or p_finished) and finished_at is null
                           then now() else finished_at end,
    last_seen_at    = now()
  where id = uid;
end;
$$;

create or replace function public.add_annotation(
  p_reader_id text, p_chapter int, p_title text, p_kind text, p_passage text, p_note text
)
returns void language plpgsql security definer set search_path = public as $$
declare uid text := auth.uid()::text;
begin
  if uid is null or p_kind not in ('highlight','comment','like') then return; end if;
  insert into public.readers (id) values (uid) on conflict (id) do nothing;
  update public.readers set last_seen_at = now() where id = uid;
  insert into public.annotations (reader_id, user_id, chapter_number, chapter_title, kind, passage, note)
  values (uid, auth.uid(), p_chapter, p_title, p_kind, nullif(p_passage,''), nullif(p_note,''));
end;
$$;

create or replace function public.add_feedback(p_reader_id text, p_rating int, p_message text)
returns void language plpgsql security definer set search_path = public as $$
declare uid text := auth.uid()::text;
begin
  if uid is null or p_message is null or p_message = '' then return; end if;
  insert into public.readers (id) values (uid) on conflict (id) do nothing;
  insert into public.feedback (reader_id, user_id, rating, message)
  values (uid, auth.uid(), p_rating, p_message);
end;
$$;

create or replace function public.subscribe_hetzal(p_reader_id text, p_email text, p_name text, p_book text)
returns void language plpgsql security definer set search_path = public as $$
declare uid text := auth.uid()::text;
begin
  if uid is null then return; end if;
  insert into public.readers (id, email, name) values (uid, nullif(p_email,''), nullif(p_name,''))
  on conflict (id) do update set
    email = coalesce(public.readers.email, nullif(excluded.email,'')),
    name  = coalesce(public.readers.name,  nullif(excluded.name,'')),
    last_seen_at = now();
  insert into public.subscribers (reader_id, email, name, book_title)
  values (uid, nullif(p_email,''), nullif(p_name,''), nullif(p_book,''))
  on conflict (reader_id) do update set
    email      = coalesce(nullif(excluded.email,''), public.subscribers.email),
    name       = coalesce(nullif(excluded.name,''),  public.subscribers.name),
    book_title = coalesce(nullif(excluded.book_title,''), public.subscribers.book_title);
end;
$$;

create or replace function public.record_share(p_reader_id text, p_channel text)
returns void language plpgsql security definer set search_path = public as $$
declare uid text := auth.uid()::text;
begin
  if uid is null then return; end if;
  insert into public.readers (id) values (uid) on conflict (id) do nothing;
  insert into public.shares (reader_id, channel) values (uid, nullif(p_channel,''));
end;
$$;

create or replace function public.set_referrer(p_reader_id text, p_ref text)
returns void language plpgsql security definer set search_path = public as $$
declare uid text := auth.uid()::text;
begin
  if uid is null or p_ref is null or p_ref = '' or p_ref = uid then return; end if;
  insert into public.readers (id) values (uid) on conflict (id) do nothing;
  update public.readers set referred_by = p_ref where id = uid and referred_by is null;
end;
$$;

-- Delete my account and everything attached to it ("Vergeet mij").
-- The auth user is removed by the server with the service-role key; this
-- clears the application rows that don't cascade from auth.users.
create or replace function public.forget_me()
returns void language plpgsql security definer set search_path = public as $$
declare uid text := auth.uid()::text;
begin
  if uid is null then return; end if;
  delete from public.chapter_stats where reader_id = uid;
  delete from public.annotations   where reader_id = uid;
  delete from public.feedback      where reader_id = uid;
  delete from public.shares        where reader_id = uid;
  delete from public.subscribers   where reader_id = uid;
  delete from public.readers       where id = uid;
end;
$$;

-- --------------------------------------------------------------------------
--  6. ROW LEVEL SECURITY — the anon key can no longer read anything.
-- --------------------------------------------------------------------------
alter table public.readers          enable row level security;
alter table public.chapter_stats    enable row level security;
alter table public.annotations      enable row level security;
alter table public.feedback         enable row level security;
alter table public.subscribers      enable row level security;
alter table public.shares           enable row level security;
alter table public.events           enable row level security;
alter table public.questions        enable row level security;
alter table public.survey_responses enable row level security;

-- Drop every previous public-read policy.
drop policy if exists "anon read readers"       on public.readers;
drop policy if exists "anon read chapter_stats" on public.chapter_stats;
drop policy if exists "anon read annotations"   on public.annotations;
drop policy if exists "anon read feedback"      on public.feedback;
drop policy if exists "anon read subscribers"   on public.subscribers;
drop policy if exists "anon read shares"        on public.shares;

-- Readers see and write only their own rows.
drop policy if exists "own reader row" on public.readers;
create policy "own reader row" on public.readers
  for select to authenticated using (id = auth.uid()::text);

drop policy if exists "own chapter stats" on public.chapter_stats;
create policy "own chapter stats" on public.chapter_stats
  for select to authenticated using (reader_id = auth.uid()::text);

drop policy if exists "own annotations" on public.annotations;
create policy "own annotations" on public.annotations
  for select to authenticated using (reader_id = auth.uid()::text);

drop policy if exists "own shares" on public.shares;
create policy "own shares" on public.shares
  for select to authenticated using (reader_id = auth.uid()::text);

drop policy if exists "own subscription" on public.subscribers;
create policy "own subscription" on public.subscribers
  for select to authenticated using (reader_id = auth.uid()::text);

drop policy if exists "own feedback read" on public.feedback;
create policy "own feedback read" on public.feedback
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "own feedback write" on public.feedback;
create policy "own feedback write" on public.feedback
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "own events read" on public.events;
create policy "own events read" on public.events
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "own events write" on public.events;
create policy "own events write" on public.events
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "own questions read" on public.questions;
create policy "own questions read" on public.questions
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "own questions write" on public.questions;
create policy "own questions write" on public.questions
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "own surveys read" on public.survey_responses;
create policy "own surveys read" on public.survey_responses
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "own surveys write" on public.survey_responses;
create policy "own surveys write" on public.survey_responses
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "own surveys update" on public.survey_responses;
create policy "own surveys update" on public.survey_responses
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- --------------------------------------------------------------------------
--  7. Grants. anon may do nothing; authenticated readers act as themselves.
--     (The dashboard uses the service-role key, which bypasses all of this.)
-- --------------------------------------------------------------------------
revoke execute on function public.register_reader(text, text, text)                          from anon;
revoke execute on function public.track_chapter(text, int, text, int, int, int, boolean)      from anon;
revoke execute on function public.update_progress(text, int, int, int, boolean)               from anon;
revoke execute on function public.set_referrer(text, text)                                    from anon;
revoke execute on function public.add_annotation(text, int, text, text, text, text)           from anon;
revoke execute on function public.add_feedback(text, int, text)                               from anon;
revoke execute on function public.subscribe_hetzal(text, text, text, text)                    from anon;
revoke execute on function public.record_share(text, text)                                    from anon;
revoke execute on function public.chapter_insights()                                          from anon;
revoke execute on function public.retention_curve()                                           from anon;
revoke execute on function public.weekly_growth()                                             from anon;

grant execute on function public.register_reader(text, text, text)                       to authenticated;
grant execute on function public.track_chapter(text, int, text, int, int, int, boolean)  to authenticated;
grant execute on function public.update_progress(text, int, int, int, boolean)           to authenticated;
grant execute on function public.set_referrer(text, text)                                to authenticated;
grant execute on function public.add_annotation(text, int, text, text, text, text)       to authenticated;
grant execute on function public.add_feedback(text, int, text)                           to authenticated;
grant execute on function public.subscribe_hetzal(text, text, text, text)                to authenticated;
grant execute on function public.record_share(text, text)                                to authenticated;
grant execute on function public.ensure_reader(text, text, text)                         to authenticated;
grant execute on function public.set_analytics_consent(boolean)                          to authenticated;
grant execute on function public.save_position(int, int, int, int, boolean)              to authenticated;
grant execute on function public.claim_legacy_reader(text)                               to authenticated;
grant execute on function public.refresh_reader_derived(uuid)                            to authenticated;
grant execute on function public.forget_me()                                             to authenticated;
