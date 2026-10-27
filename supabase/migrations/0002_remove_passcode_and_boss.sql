-- 2026-10-27: no host passcode, no boss round.
-- Anyone who opens /host can run the session; the app still never needs a secret key.

drop function if exists public.submit_boss(uuid, text, text, jsonb);
drop table if exists public.boss_submissions;

drop function if exists public.host_action(text, text, int);
drop function if exists public.host_check(text);
drop table if exists private.host_secret;
drop schema if exists private;

update public.session set phase = 'ended' where phase = 'boss';
alter table public.session drop constraint if exists session_phase_check;
alter table public.session add constraint session_phase_check check (phase in ('lobby', 'running', 'paused', 'ended'));

create function public.host_action(p_action text, p_minutes int default null)
returns public.session language plpgsql security definer set search_path = public as $$
declare
  s session;
  remaining int;
begin
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
    when 'end' then
      update session set phase = 'ended', ends_at = null, paused_remaining_s = null, updated_at = now() where id = 1;
    when 'lobby' then
      update session set phase = 'lobby', ends_at = null, paused_remaining_s = null, updated_at = now() where id = 1;
    when 'reset' then
      delete from completions where true;
      delete from teams where true;
      update session set phase = 'lobby', ends_at = null, paused_remaining_s = null, updated_at = now() where id = 1;
    else
      raise exception 'Unknown action %', p_action;
  end case;
  select * into s from session where id = 1;
  return s;
end $$;

revoke execute on function public.host_action(text, int) from public;
grant execute on function public.host_action(text, int) to anon, authenticated;
