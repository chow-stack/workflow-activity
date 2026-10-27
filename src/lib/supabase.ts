import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("Supabase env vars are missing.");
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

export type Phase = "lobby" | "running" | "paused" | "boss" | "ended";

export interface SessionRow {
  phase: Phase;
  ends_at: string | null;
  paused_remaining_s: number | null;
}

export interface TeamRow {
  id: string;
  name: string;
  created_at: string;
}

export interface CompletionRow {
  team_id: string;
  level: number;
  points: number;
  hints_used: number;
  skipped: boolean;
  completed_at: string;
}

export interface BossRow {
  team_id: string;
  title: string;
  problem: string;
  workflow: unknown;
  submitted_at: string;
}
