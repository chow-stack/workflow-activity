import type { CompletionRow, TeamRow } from "./supabase";

export const HINT_PENALTY = 0.25;

export function pointsFor(levelPoints: number, hintsUsed: number, skipped = false): number {
  if (skipped) return 0;
  return Math.round(levelPoints * (1 - HINT_PENALTY * Math.min(hintsUsed, 2)));
}

export interface Standing {
  team: TeamRow;
  points: number;
  cleared: number[];
  skipped: number[];
  lastAt: number;
}

export function standings(teams: TeamRow[], completions: CompletionRow[]): Standing[] {
  const rows = teams.map<Standing>((team) => ({ team, points: 0, cleared: [], skipped: [], lastAt: Infinity }));
  const byId = new Map(rows.map((r) => [r.team.id, r]));
  for (const c of completions) {
    const r = byId.get(c.team_id);
    if (!r || c.level === 0) continue; // the demo doesn't count toward the board
    r.points += c.points;
    (c.skipped ? r.skipped : r.cleared).push(c.level);
    const t = Date.parse(c.completed_at);
    r.lastAt = r.lastAt === Infinity ? t : Math.max(r.lastAt, t);
  }
  return rows.sort(
    (a, b) =>
      b.points - a.points ||
      b.cleared.length - a.cleared.length ||
      a.lastAt - b.lastAt ||
      a.team.name.localeCompare(b.team.name),
  );
}
