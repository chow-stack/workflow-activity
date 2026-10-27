"use client";

import { useEffect, useState } from "react";
import { supabase, type CompletionRow, type SessionRow, type TeamRow } from "./supabase";

/** Live session row. `offline` is true when Supabase can't be reached. */
export function useSession() {
  const [session, setSession] = useState<SessionRow | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const db = supabase();
    let alive = true;
    const fetchIt = async () => {
      const { data, error } = await db.from("session").select("phase, ends_at, paused_remaining_s").eq("id", 1).single();
      if (!alive) return;
      if (error) setOffline(true);
      else {
        setOffline(false);
        setSession(data as SessionRow);
      }
    };
    fetchIt();
    const ch = db
      .channel("session")
      .on("postgres_changes", { event: "*", schema: "public", table: "session" }, (p) => {
        const row = p.new as SessionRow;
        if (row?.phase) setSession({ phase: row.phase, ends_at: row.ends_at, paused_remaining_s: row.paused_remaining_s });
      })
      .subscribe();
    // Safety net in case a realtime event is missed.
    const poll = window.setInterval(fetchIt, 15000);
    return () => {
      alive = false;
      window.clearInterval(poll);
      db.removeChannel(ch);
    };
  }, []);

  return { session, offline };
}

/** Teams and completions, kept live. */
export function useLeaderboardData() {
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [completions, setCompletions] = useState<CompletionRow[]>([]);

  useEffect(() => {
    const db = supabase();
    let alive = true;
    const refresh = async () => {
      const [t, c] = await Promise.all([db.from("teams").select("*").order("created_at"), db.from("completions").select("*")]);
      if (!alive) return;
      if (t.data) setTeams(t.data as TeamRow[]);
      if (c.data) setCompletions(c.data as CompletionRow[]);
    };
    refresh();
    const ch = db
      .channel("board")
      .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "completions" }, refresh)
      .subscribe();
    const poll = window.setInterval(refresh, 10000);
    return () => {
      alive = false;
      window.clearInterval(poll);
      db.removeChannel(ch);
    };
  }, []);

  return { teams, completions };
}

/** Re-renders every second; returns ms since epoch, or 0 before mount (prerender has no clock). */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, intervalMs);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [intervalMs]);
  return now;
}

export function secondsLeft(session: SessionRow | null, now: number): number | null {
  if (!session || !now) return null;
  if (session.phase === "paused") return session.paused_remaining_s ?? 0;
  if (!session.ends_at) return null;
  return Math.max(0, Math.round((Date.parse(session.ends_at) - now) / 1000));
}

export function formatClock(s: number | null): string {
  if (s === null) return "--:--";
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
