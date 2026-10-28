-- 2026-10-27: rooms with join codes (Kahoot-style) and a guided demo phase.
-- Additive: the old singleton `session` table stays until the new app is deployed, then 0004 drops it.

create table public.rooms (
  code text primary key check (code ~ '^[A-Z0-9]{5}$'),
  phase text not null default 'lobby' check (phase in ('lobby', 'demo', 'running', 'paused', 'ended')),
  ends_at timestamptz,
  paused_remaining_s int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The host's secret lives apart from `rooms` so the public can read rooms without ever seeing it.
create table public.room_keys (
  code text primary key references public.rooms on delete cascade,
  host_key uuid not null default gen_random_uuid()
);

alter table public.rooms enable row level security;
alter table public.room_keys enable row level security; -- no policies: only security definer functions touch it
revoke all on public.room_keys from anon, authenticated;
create policy "read rooms" on public.rooms for select to anon, authenticated using (true);

alter table public.teams add column room_code text references public.rooms on delete cascade;
drop index if exists public.teams_name_ci;
create unique index teams_room_name_ci on public.teams (room_code, lower(btrim(name)));
create index teams_room_code_idx on public.teams (room_code);

alter table public.completions add column room_code text references public.rooms on delete cascade;
create index completions_room_code_idx on public.completions (room_code);
alter table public.completions drop constraint if exists completions_level_check;
alter table public.completions add constraint completions_level_check check (level between 0 and 8); -- 0 = demo

drop policy if exists "create team before the end" on public.teams;
create policy "join an open room" on public.teams for insert to anon, authenticated with check (
  (room_code is null and (select phase from public.session where id = 1) <> 'ended')
  or exists (select 1 from public.rooms r where r.code = teams.room_code and r.phase <> 'ended')
);

drop policy if exists "complete levels while running" on public.completions;
create policy "complete levels while open" on public.completions for insert to anon, authenticated with check (
  (room_code is null and (select phase from public.session where id = 1) = 'running')
  or exists (
    select 1 from public.teams t join public.rooms r on r.code = t.room_code
    where t.id = completions.team_id and t.room_code = completions.room_code
      and (r.phase = 'running' or (completions.level = 0 and r.phase in ('demo', 'running')))
  )
);

create function public.create_room()
returns table (code text, host_key uuid) language plpgsql security definer set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no 0/O, 1/I
  c text;
begin
  loop
    c := '';
    for i in 1..5 loop
      c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from rooms where rooms.code = c);
  end loop;
  insert into rooms (code) values (c);
  insert into room_keys (code) values (c);
  return query select k.code, k.host_key from room_keys k where k.code = c;
end $$;

create function public.host_room(p_code text, p_key uuid, p_action text, p_minutes int default null)
returns public.rooms language plpgsql security definer set search_path = public as $$
declare
  r rooms;
  remaining int;
begin
  if not exists (select 1 from room_keys k where k.code = p_code and k.host_key = p_key) then
    raise exception 'Not the host of this room.';
  end if;
  select * into r from rooms where code = p_code;
  case p_action
    when 'demo' then
      update rooms set phase = 'demo', ends_at = null, paused_remaining_s = null, updated_at = now() where code = p_code;
    when 'start' then
      update rooms set phase = 'running', ends_at = now() + make_interval(mins => coalesce(p_minutes, 30)),
        paused_remaining_s = null, updated_at = now() where code = p_code;
    when 'pause' then
      remaining := greatest(0, extract(epoch from (r.ends_at - now()))::int);
      update rooms set phase = 'paused', paused_remaining_s = remaining, ends_at = null, updated_at = now() where code = p_code;
    when 'resume' then
      update rooms set phase = 'running', ends_at = now() + make_interval(secs => coalesce(r.paused_remaining_s, 0)),
        paused_remaining_s = null, updated_at = now() where code = p_code;
    when 'add_time' then
      update rooms set ends_at = coalesce(ends_at, now()) + make_interval(mins => coalesce(p_minutes, 5)), updated_at = now() where code = p_code;
    when 'end' then
      update rooms set phase = 'ended', ends_at = null, paused_remaining_s = null, updated_at = now() where code = p_code;
    when 'lobby' then
      update rooms set phase = 'lobby', ends_at = null, paused_remaining_s = null, updated_at = now() where code = p_code;
    when 'reset' then
      delete from teams where room_code = p_code;
      update rooms set phase = 'lobby', ends_at = null, paused_remaining_s = null, updated_at = now() where code = p_code;
    else
      raise exception 'Unknown action %', p_action;
  end case;
  select * into r from rooms where code = p_code;
  return r;
end $$;

revoke execute on function public.create_room() from public;
revoke execute on function public.host_room(text, uuid, text, int) from public;
grant execute on function public.create_room() to anon, authenticated;
grant execute on function public.host_room(text, uuid, text, int) to anon, authenticated;

alter publication supabase_realtime add table public.rooms;
