"use client";

import { ExternalLink, LoaderCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { formatClock, secondsLeft, useLeaderboardData, useNow, useSession } from "@/lib/live";
import { standings } from "@/lib/scoring";
import { supabase } from "@/lib/supabase";
import { Stepper } from "./panels/fields";
import { Button, Logo } from "./ui";

type Action = "start" | "pause" | "resume" | "add_time" | "end" | "lobby" | "reset";

const PHASE_TEXT = {
  lobby: "Players are joining. Start when everyone's in.",
  running: "Players are building.",
  paused: "The clock is stopped and player screens are covered.",
  ended: "Over. Players see their final score.",
} as const;

export function HostScreen() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Action | null>(null);
  const [minutes, setMinutes] = useState(30);
  const { session } = useSession();
  const { teams, completions } = useLeaderboardData();
  const now = useNow();
  const rows = useMemo(() => standings(teams, completions), [teams, completions]);

  const act = async (action: Action, mins?: number) => {
    if (action === "reset" && !window.confirm("Delete every player and score and go back to the lobby?")) return;
    if (action === "end" && !window.confirm("End the activity for everyone?")) return;
    setBusy(action);
    const { error: err } = await supabase().rpc("host_action", { p_action: action, p_minutes: mins ?? null });
    setBusy(null);
    setError(err ? err.message : null);
  };

  const phase = session?.phase ?? "lobby";
  const btn = (action: Action, label: string, opts: { variant?: "primary" | "secondary" | "danger"; mins?: number } = {}) => (
    <Button variant={opts.variant ?? "secondary"} onClick={() => act(action, opts.mins)} disabled={busy !== null}>
      {busy === action && <LoaderCircle size={15} className="animate-spin" />}
      {label}
    </Button>
  );

  return (
    <div className="min-h-screen bg-paper">
      <header className="flex h-16 items-center border-b border-line px-8">
        <Logo />
        <a href="/board" target="_blank" className="ml-auto flex items-center gap-1.5 text-[14px] font-medium text-ink-2 hover:underline">
          Open projector board <ExternalLink size={14} />
        </a>
      </header>

      <main className="mx-auto max-w-3xl px-8 py-10">
        <div className="eyebrow">Host controls</div>
        <div className="mt-2 flex items-baseline gap-4">
          <h1 className="display text-[40px] capitalize">{phase}</h1>
          <span className="text-[28px] font-semibold text-muted tabular-nums">{formatClock(secondsLeft(session, now))}</span>
        </div>
        <p className="text-[15px] text-muted">{PHASE_TEXT[phase]}</p>
        {error && <p className="mt-3 rounded bg-fail-soft px-3 py-2 text-[13.5px] text-fail">{error}</p>}

        <section className="mt-8 rounded-lg bg-cream p-6 ring-1 ring-line">
          <h2 className="text-[15px] font-semibold">Round</h2>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {(phase === "lobby" || phase === "ended") && (
              <>
                <Stepper value={minutes} onChange={setMinutes} min={5} max={90} step={5} suffix="min" />
                {btn("start", "Start the round", { variant: "primary", mins: minutes })}
              </>
            )}
            {phase === "running" && (
              <>
                {btn("pause", "Pause")}
                {btn("add_time", "+5 minutes", { mins: 5 })}
                {btn("end", "End round", { variant: "primary" })}
              </>
            )}
            {phase === "paused" && (
              <>
                {btn("resume", "Resume", { variant: "primary" })}
                {btn("end", "End round")}
              </>
            )}
          </div>
        </section>

        <section className="mt-4 rounded-lg bg-paper p-6 ring-1 ring-line">
          <h2 className="text-[15px] font-semibold">
            Standings{" "}
            <span className="font-normal text-muted">
              · {teams.length} {teams.length === 1 ? "player" : "players"}
            </span>
          </h2>
          <ol className="mt-3 divide-y divide-line text-[14.5px]">
            {rows.map((r, i) => (
              <li key={r.team.id} className="flex items-center gap-3 py-2.5">
                <span className="w-6 text-muted">{i + 1}</span>
                <span className="flex-1 truncate font-medium">{r.team.name}</span>
                <span className="text-muted">{r.cleared.length}/8 cleared</span>
                <span className="w-20 text-right font-semibold tabular-nums">{r.points}</span>
              </li>
            ))}
            {rows.length === 0 && <li className="py-2 text-muted">No players yet.</li>}
          </ol>
        </section>

        <section className="mt-8 flex flex-wrap gap-3 border-t border-line pt-6">
          {phase !== "lobby" && btn("lobby", "Back to lobby")}
          {btn("reset", "Reset everything", { variant: "danger" })}
        </section>
      </main>
    </div>
  );
}
