import type { Progress, Team } from "./store";
import { supabase, type CompletionRow, type RoomRow, type TeamRow } from "./supabase";

const OFFLINE = "Couldn't reach the server. Check the wifi and try again.";
const cleanName = (name: string) => name.trim().replace(/\s+/g, " ");

/** Look up a room by code before asking for a name. */
export async function findRoom(code: string): Promise<{ room?: RoomRow; error?: string }> {
  if (code.length !== 5) return { error: "Room codes are 5 characters." };
  const { data, error } = await supabase().from("rooms").select("code, phase, ends_at, paused_remaining_s").eq("code", code).maybeSingle();
  if (error) return { error: OFFLINE };
  if (!data) return { error: "No room with that code. Check the big screen." };
  if ((data as RoomRow).phase === "ended") return { error: "That room has finished." };
  return { room: data as RoomRow };
}

/** Join a room. `taken` means someone already used this name there (it may be the same person on a new device). */
export async function joinRoom(room: string, name: string): Promise<{ team?: Team; error?: string; taken?: boolean }> {
  const clean = cleanName(name);
  if (!clean) return { error: "Enter your name." };
  if (clean.length > 40) return { error: "Keep it under 40 characters." };
  const { data, error } = await supabase().from("teams").insert({ name: clean, room_code: room }).select("id, name").single();
  if (error) {
    if (error.code === "23505") return { error: `Someone in this room is already “${clean}”.`, taken: true };
    if (error.code === "42501") return { error: "That room has finished, so new players can't join." };
    return { error: OFFLINE };
  }
  return { team: { ...(data as { id: string; name: string }), room } };
}

/** Continue as an existing player in a room (e.g. after switching laptops). */
export async function rejoinRoom(room: string, name: string): Promise<{ team?: Team; error?: string }> {
  const { data, error } = await supabase().from("teams").select("id, name").eq("room_code", room);
  if (error) return { error: OFFLINE };
  const want = cleanName(name).toLowerCase();
  const hit = (data as Pick<TeamRow, "id" | "name">[]).find((t) => t.name.toLowerCase() === want);
  return hit ? { team: { id: hit.id, name: hit.name, room } } : { error: "Nobody in this room has that exact name." };
}

export async function fetchDone(teamId: string): Promise<Progress["done"] | null> {
  const { data, error } = await supabase().from("completions").select("*").eq("team_id", teamId);
  if (error) return null;
  return Object.fromEntries((data as CompletionRow[]).map((c) => [c.level, { points: c.points, skipped: c.skipped }]));
}

export async function recordCompletion(team: Team, level: number, points: number, hintsUsed: number, skipped: boolean) {
  const { error } = await supabase()
    .from("completions")
    .insert({ team_id: team.id, room_code: team.room, level, points, hints_used: hintsUsed, skipped });
  return !error || error.code === "23505";
}

/** Push locally finished levels the server doesn't know about yet (e.g. after a wifi drop). */
export async function syncDone(team: Team, progress: Progress) {
  const server = await fetchDone(team.id);
  if (!server) return;
  for (const [lvl, d] of Object.entries(progress.done)) {
    if (!server[Number(lvl)]) await recordCompletion(team, Number(lvl), d.points, progress.hints[Number(lvl)] ?? 0, d.skipped);
  }
}

/** Host side: create a room and remember its secret key on this device. */
export async function createRoom(): Promise<{ code?: string; hostKey?: string; error?: string }> {
  const { data, error } = await supabase().rpc("create_room");
  if (error || !data?.[0]) return { error: OFFLINE };
  return { code: data[0].code as string, hostKey: data[0].host_key as string };
}
