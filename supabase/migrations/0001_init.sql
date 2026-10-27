-- Workflow Activity schema. Host controls go through passcode-checked security definer
-- functions, so the app never needs the service-role key.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.host_secret (
  id int primary key default 1 check (id = 1),
  passcode_hash text not null
);

create table public.session (
  id int primary key default 1 check (id = 1),
  phase text not null default 'lobby' check (phase in ('lobby', 'running', 'paused', 'boss', 'ended')),
  ends_at timestamptz,
  paused_remaining_s int,
  updated_at timestamptz not null default now()
);
insert into public.session default values;

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  created_at timestamptz not null default now()
);
create unique index teams_name_ci on public.teams (lower(btrim(name)));

create table public.completions (
  team_id uuid not null references public.teams on delete cascade,
  level int not null check (level between 1 and 8),
  points int not null check (points between 0 and 400),
  hints_used int not null default 0 check (hints_used between 0 and 2),
  skipped boolean not null default false,
  completed_at timestamptz not null default now(),
  primary key (team_id, level)
);

create table public.boss_submissions (
  team_id uuid primary key references public.teams on delete cascade,
  title text not null check (char_length(title) between 1 and 60),
  problem text not null check (char_length(problem) between 1 and 140),
  workflow jsonb not null,
  submitted_at timestamptz not null default now()
);

alter table public.session enable row level security;
alter table public.teams enable row level security;
alter table public.completions enable row level security;
alter table public.boss_submissions enable row level security;

create policy "read session" on public.session for select to anon, authenticated using (true);
create policy "read teams" on public.teams for select to anon, authenticated using (true);
create policy "read completions" on public.completions for select to anon, authenticated using (true);
create policy "read boss" on public.boss_submissions for select to anon, authenticated using (true);

create policy "create team before the end" on public.teams for insert to anon, authenticated
  with check ((select phase from public.session where id = 1) <> 'ended');

create policy "complete levels while running" on public.completions for insert to anon, authenticated
  with check ((select phase from public.session where id = 1) = 'running');

-- Boss designs: upsert through a function (anon has no update rights).
create function public.submit_boss(p_team uuid, p_title text, p_problem text, p_workflow jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if (select phase from session where id = 1) <> 'boss' then
    raise exception 'The boss round is not open.';
  end if;
  insert into boss_submissions (team_id, title, problem, workflow)
  values (p_team, btrim(p_title), btrim(p_problem), p_workflow)
  on conflict (team_id) do update
    set title = excluded.title, problem = excluded.problem, workflow = excluded.workflow, submitted_at = now();
end $$;

create function public.host_check(p_passcode text)
returns boolean language sql security definer set search_path = public, extensions as $$
  select exists (
    select 1 from private.host_secret
    where passcode_hash = extensions.crypt(p_passcode, passcode_hash)
  );
$$;

create function public.host_action(p_passcode text, p_action text, p_minutes int default null)
returns public.session language plpgsql security definer set search_path = public, extensions as $$
declare
  s session;
  remaining int;
begin
  if not host_check(p_passcode) then
    raise exception 'Wrong host passcode.';
  end if;
  select * into s from session where id = 1;
  case p_action
    when 'start' then
      update session set phase = 'running', ends_at = now() + make_interval(mins => coalesce(p_minutes, 30)),
        paused_remaining_s = null, updated_at = now() where id = 1;
    when 'pause' then
      remaining := greatest(0, extract(epoch from (s.ends_at - now()))::int);
      update session set phase = 'paused', paused_remaining_s = remaining, ends_at = null, updated_at = now() where id = 1;
    when 'resume' then
      update session set phase = 'running', ends_at = now() + make_interval(secs => coalesce(s.paused_remaining_s, 0)),
        paused_remaining_s = null, updated_at = now() where id = 1;
    when 'add_time' then
      update session set ends_at = coalesce(ends_at, now()) + make_interval(mins => coalesce(p_minutes, 5)), updated_at = now() where id = 1;
    when 'boss' then
      update session set phase = 'boss', ends_at = now() + make_interval(mins => coalesce(p_minutes, 10)),
        paused_remaining_s = null, updated_at = now() where id = 1;
    when 'end' then
      update session set phase = 'ended', ends_at = null, paused_remaining_s = null, updated_at = now() where id = 1;
    when 'lobby' then
      update session set phase = 'lobby', ends_at = null, paused_remaining_s = null, updated_at = now() where id = 1;
    when 'reset' then
      delete from boss_submissions where true;
      delete from completions where true;
      delete from teams where true;
      update session set phase = 'lobby', ends_at = null, paused_remaining_s = null, updated_at = now() where id = 1;
    else
      raise exception 'Unknown action %', p_action;
  end case;
  select * into s from session where id = 1;
  return s;
end $$;

revoke execute on function public.host_action(text, text, int) from public;
revoke execute on function public.host_check(text) from public;
revoke execute on function public.submit_boss(uuid, text, text, jsonb) from public;
grant execute on function public.host_action(text, text, int) to anon, authenticated;
grant execute on function public.host_check(text) to anon, authenticated;
grant execute on function public.submit_boss(uuid, text, text, jsonb) to anon, authenticated;

alter publication supabase_realtime add table public.session, public.teams, public.completions, public.boss_submissions;
