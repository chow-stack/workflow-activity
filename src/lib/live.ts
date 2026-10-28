"use client";

import { useEffect, useState } from "react";
import { supabase, type CompletionRow, type RoomRow, type TeamRow } from "./supabase";

/** Live state of one room. `offline` is true when Supabase can't be reached; `missing` when the code doesn't exist. */
export function useRoom(code: string | null) {
  const [room, setRoom] = useState<RoomRow | null>(null);
  const [offline, setOffline] = useState(false);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!code) return;
    const db = supabase();
    let alive = true;
    const fetchIt = async () => {
      const { data, error } = await db.from("rooms").select("code, phase, ends_at, paused_remaining_s").eq("code", code).maybeSingle();
      if (!alive) return;
      if (error) return setOffline(true);
      setOffline(false);
      setMissing(!data);
      if (data) setRoom(data as RoomRow);
    };
    fetchIt();
    const ch = db
      .channel(`room-${code}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `code=eq.${code}` }, (p) => {
        const row = p.new as RoomRow;
        if (row?.phase) setRoom({ code: row.code, phase: row.phase, ends_at: row.ends_at, paused_remaining_s: row.paused_remaining_s });
      })
      .subscribe();
    // Safety net in case a realtime event is missed.
    const poll = window.setInterval(fetchIt, 15000);
    return () => {
      alive = false;
      window.clearInterval(poll);
      db.removeChannel(ch);
    };
  }, [code]);

  return { room, offline, missing };
}

/** Players and completions in one room, kept live. */
export function useLeaderboardData(code: string | null) {
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [completions, setCompletions] = useState<CompletionRow[]>([]);

  useEffect(() => {
    if (!code) return;
    const db = supabase();
    let alive = true;
    const refresh = async () => {
      const [t, c] = await Promise.all([
        db.from("teams").select("*").eq("room_code", code).order("created_at"),
        db.from("completions").select("*").eq("room_code", code),
      ]);
      if (!alive) return;
      if (t.data) setTeams(t.data as TeamRow[]);
      if (c.data) setCompletions(c.data as CompletionRow[]);
    };
    refresh();
    const ch = db
      .channel(`board-${code}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "teams", filter: `room_code=eq.${code}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "completions", filter: `room_code=eq.${code}` }, refresh)
      .subscribe();
    const poll = window.setInterval(refresh, 10000);
    return () => {
      alive = false;
      window.clearInterval(poll);
      db.removeChannel(ch);
    };
  }, [code]);

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

export function secondsLeft(room: RoomRow | null, now: number): number | null {
  if (!room || !now) return null;
  if (room.phase === "paused") return room.paused_remaining_s ?? 0;
  if (!room.ends_at) return null;
  return Math.max(0, Math.round((Date.parse(room.ends_at) - now) / 1000));
}

export function formatClock(s: number | null): string {
  if (s === null) return "--:--";
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
