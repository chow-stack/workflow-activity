-- Apply ONLY after the rooms-based app (0003) is deployed. Removes the old singleton session and room-less players.

delete from public.teams where room_code is null; -- cascades their completions

drop policy if exists "join an open room" on public.teams;
create policy "join an open room" on public.teams for insert to anon, authenticated with check (
  exists (select 1 from public.rooms r where r.code = teams.room_code and r.phase <> 'ended')
);

drop policy if exists "complete levels while open" on public.completions;
create policy "complete levels while open" on public.completions for insert to anon, authenticated with check (
  exists (
    select 1 from public.teams t join public.rooms r on r.code = t.room_code
    where t.id = completions.team_id and t.room_code = completions.room_code
      and (r.phase = 'running' or (completions.level = 0 and r.phase in ('demo', 'running')))
  )
);

alter table public.teams alter column room_code set not null;
alter table public.completions alter column room_code set not null;

drop function if exists public.host_action(text, int);
drop table if exists public.session;
