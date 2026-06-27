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
