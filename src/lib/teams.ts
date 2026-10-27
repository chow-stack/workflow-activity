import type { Progress, Team } from "./store";
import { supabase, type CompletionRow, type TeamRow } from "./supabase";

export async function createTeam(name: string): Promise<{ team?: Team; error?: string }> {
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean) return { error: "Enter your name." };
  if (clean.length > 40) return { error: "Keep it under 40 characters." };
  const { data, error } = await supabase().from("teams").insert({ name: clean }).select("id, name").single();
  if (error) {
    if (error.code === "23505") return { error: "Someone already joined with that name. Add your last initial, or use “Pick up where you left off” if it's you." };
    if (error.code === "42501") return { error: "The activity has ended, so new players can't join." };
    return { error: "Couldn't reach the server. Check the wifi and try again." };
  }
  return { team: data as Team };
}

export async function findTeam(name: string): Promise<{ team?: Team; error?: string }> {
  const { data, error } = await supabase().from("teams").select("id, name");
  if (error) return { error: "Couldn't reach the server. Check the wifi and try again." };
  const want = name.trim().replace(/\s+/g, " ").toLowerCase();
  const hit = (data as TeamRow[]).find((t) => t.name.toLowerCase() === want);
  return hit ? { team: { id: hit.id, name: hit.name } } : { error: "Nobody joined with that exact name. Check the spelling." };
}

export async function fetchDone(teamId: string): Promise<Progress["done"] | null> {
  const { data, error } = await supabase().from("completions").select("*").eq("team_id", teamId);
  if (error) return null;
  return Object.fromEntries((data as CompletionRow[]).map((c) => [c.level, { points: c.points, skipped: c.skipped }]));
}

export async function recordCompletion(teamId: string, level: number, points: number, hintsUsed: number, skipped: boolean) {
  const { error } = await supabase()
    .from("completions")
    .insert({ team_id: teamId, level, points, hints_used: hintsUsed, skipped });
  return !error || error.code === "23505";
}

/** Push locally finished levels the server doesn't know about yet (e.g. after a wifi drop). */
export async function syncDone(teamId: string, progress: Progress) {
  const server = await fetchDone(teamId);
  if (!server) return;
  for (const [lvl, d] of Object.entries(progress.done)) {
    if (!server[Number(lvl)]) await recordCompletion(teamId, Number(lvl), d.points, progress.hints[Number(lvl)] ?? 0, d.skipped);
  }
}

