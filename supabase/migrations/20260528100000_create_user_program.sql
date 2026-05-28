-- 12.3b — user_program table for Prelude round-trip persistence.
--
-- One row per user. The engine is deterministic, so the table only needs to
-- persist the engine output blob plus the lookup keys the app reads back
-- (goal_id, goal_phase, engine_version, kb_l5_version). No templated-fallback
-- columns (Tier B deferred), no served_templated flag, no live-AI metadata.
--
-- Inserts/updates flow exclusively through app/api/prelude/complete; that
-- route authenticates the session and runs the converter+engine before the
-- upsert. RLS keys every row on auth.uid() = user_id so a leaked anon key
-- can never read another user's program.

create table if not exists public.user_program (
  user_id uuid primary key references auth.users(id) on delete cascade,
  program jsonb not null,
  engine_version text not null,
  kb_l5_version text,
  goal_id text not null,
  goal_phase text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_program enable row level security;

-- Four-policy RLS. Every row keyed on the authenticated user; no service
-- role bypass needed in the route (the upsert runs under the user's JWT).
create policy "user_program_select_own"
  on public.user_program for select
  to authenticated
  using (auth.uid() = user_id);

create policy "user_program_insert_own"
  on public.user_program for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "user_program_update_own"
  on public.user_program for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_program_delete_own"
  on public.user_program for delete
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.user_program_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_program_set_updated_at on public.user_program;
create trigger user_program_set_updated_at
  before update on public.user_program
  for each row
  execute function public.user_program_set_updated_at();
