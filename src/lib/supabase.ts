import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

// NEXT_PUBLIC_* values are inlined at build time, so they must be set in Vercel before the build runs.
export const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

export function supabase(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("Supabase env vars are missing.");
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

export type Phase = "lobby" | "demo" | "running" | "paused" | "ended";

/** A room's live state. Players join a room with its code; the host controls it with a secret key. */
export interface RoomRow {
  code: string;
  phase: Phase;
  ends_at: string | null;
  paused_remaining_s: number | null;
}

export interface TeamRow {
  id: string;
  name: string;
  room_code: string | null;
  created_at: string;
}

export interface CompletionRow {
  team_id: string;
  room_code: string | null;
  level: number; // 0 = demo
  points: number;
  hints_used: number;
  skipped: boolean;
  completed_at: string;
}

export const normalizeCode = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
