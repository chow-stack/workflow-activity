"use client";

import { Timer } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { LEVELS, MAX_POINTS } from "@/levels";
import { formatClock, secondsLeft, useLeaderboardData, useNow, useSession } from "@/lib/live";
import { standings } from "@/lib/scoring";
import { Logo } from "./ui";

const PHASE_LABEL = { lobby: "Waiting to start", running: "Live", paused: "Paused", ended: "Final standings" } as const;

export function BoardScreen() {
  const { session } = useSession();
  const { teams, completions } = useLeaderboardData();
  const now = useNow();
  const rows = useMemo(() => standings(teams, completions), [teams, completions]);
  const ticker = useTicker(completions, teams);
  const phase = session?.phase ?? "lobby";
  const left = secondsLeft(session, now);
  const host = useSyncExternalStore(
    () => () => {},
    () => window.location.host,
    () => "",
  );

  return (
    <div className="flex min-h-screen flex-col bg-paper px-12 py-8">
      <header className="flex items-center gap-6">
        <Logo />
        <div className="ml-auto flex items-center gap-4">
          <span
            className={`rounded-full px-4 py-1.5 text-[16px] font-semibold ${
              phase === "running" ? "bg-crimson text-paper" : phase === "paused" ? "bg-warn-soft text-warn" : "bg-ink text-paper"
            }`}
          >
            {PHASE_LABEL[phase]}
          </span>
          {left !== null && (
            <span className="flex items-center gap-2 text-[44px] leading-none font-semibold tabular-nums">
              <Timer size={34} className="text-muted" />
              {formatClock(left)}
            </span>
          )}
        </div>
      </header>

      {phase === "lobby" ? (
        <div className="my-auto text-center">
          <div className="eyebrow">Workflow Lab</div>
          <h1 className="display mt-3 text-[64px] leading-tight">Grab a laptop. Pick a captain.</h1>
          <p className="mt-3 text-[24px] text-ink-2">
            Go to <span className="font-semibold text-crimson">{host}</span> and create your team.
          </p>
          <div className="mx-auto mt-12 flex max-w-5xl flex-wrap justify-center gap-3">
            {teams.map((t) => (
              <span key={t.id} className="animate-pop rounded-full bg-cream px-5 py-2.5 text-[20px] font-medium ring-1 ring-line">
                {t.name}
              </span>
            ))}
            {teams.length === 0 && <span className="text-[18px] text-muted">No teams yet.</span>}
          </div>
        </div>
      ) : (
        <>
          <div className="mt-10 mb-3 grid grid-cols-[64px_1fr_auto_150px] items-end gap-6 px-6 text-[13px] font-semibold tracking-[0.06em] text-muted uppercase">
            <span>#</span>
            <span>Team</span>
            <span className="flex gap-3">
              {LEVELS.map((l) => (
                <span key={l.id} className="w-9 text-center">
                  L{l.id}
                </span>
              ))}
            </span>
            <span className="text-right">Points</span>
          </div>
          <ol className="space-y-2">
            {rows.map((r, i) => (
              <li
                key={r.team.id}
                className={`grid grid-cols-[64px_1fr_auto_150px] items-center gap-6 rounded-lg px-6 py-4 ${
                  i === 0 && r.points > 0 ? "bg-crimson-soft ring-2 ring-crimson/40" : "bg-paper ring-1 ring-line"
                }`}
              >
                <span className={`display text-[34px] ${i < 3 && r.points > 0 ? "text-crimson" : "text-faint"}`}>{i + 1}</span>
                <span className="truncate text-[26px] font-semibold">{r.team.name}</span>
                <span className="flex gap-3">
                  {LEVELS.map((l) => (
                    <span
                      key={l.id}
                      className={`size-9 rounded-full ${
                        r.cleared.includes(l.id) ? "bg-crimson" : r.skipped.includes(l.id) ? "bg-sand" : "ring-2 ring-line ring-inset"
                      }`}
                    />
                  ))}
                </span>
                <span className="text-right text-[30px] font-semibold tabular-nums">{r.points.toLocaleString()}</span>
              </li>
            ))}
          </ol>
          {rows.length === 0 && <p className="mt-10 text-center text-[20px] text-muted">No teams yet.</p>}

          <footer className="mt-auto flex items-center gap-4 pt-8 text-[17px] text-muted">
            <span>Max {MAX_POINTS.toLocaleString()} pts · hints cost 25%</span>
            {ticker && (
              <span key={ticker.key} className="animate-rise ml-auto rounded-full bg-ink px-5 py-2 font-medium text-paper">
                {ticker.text}
              </span>
            )}
          </footer>
        </>
      )}
    </div>
  );
}

/** "Team X just cleared Level 6" for the newest completion. */
function useTicker(
  completions: { team_id: string; level: number; skipped: boolean; completed_at: string }[],
  teams: { id: string; name: string }[],
) {
  const seen = useRef<number>(0);
  const [msg, setMsg] = useState<{ key: string; text: string } | null>(null);
  useEffect(() => {
    const latest = completions.filter((c) => !c.skipped).sort((a, b) => Date.parse(b.completed_at) - Date.parse(a.completed_at))[0];
    if (!latest) return;
    const t = Date.parse(latest.completed_at);
    if (t <= seen.current) return;
    const first = seen.current === 0;
    seen.current = t;
    if (first) return;
    const name = teams.find((x) => x.id === latest.team_id)?.name ?? "A team";
    setMsg({ key: `${latest.team_id}-${latest.level}`, text: `${name} just cleared Level ${latest.level}` });
    const id = window.setTimeout(() => setMsg(null), 8000);
    return () => window.clearTimeout(id);
  }, [completions, teams]);
  return msg;
}
