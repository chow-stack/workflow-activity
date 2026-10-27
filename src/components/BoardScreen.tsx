"use client";

import { ChevronLeft, ChevronRight, Timer } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Workflow } from "@/engine/types";
import { LEVELS, MAX_POINTS, boss as bossLevel } from "@/levels";
import { formatClock, secondsLeft, useLeaderboardData, useNow, useSession } from "@/lib/live";
import { standings } from "@/lib/scoring";
import { Canvas } from "./canvas/Canvas";
import { Logo } from "./TopBar";

const PHASE_LABEL = { lobby: "Waiting to start", running: "Live", paused: "Paused", boss: "Boss round", ended: "Final standings" } as const;

export function BoardScreen() {
  const { session } = useSession();
  const { teams, completions, boss } = useLeaderboardData();
  const now = useNow();
  const [galleryOpen, setGalleryOpen] = useState(false);
  const rows = useMemo(() => standings(teams, completions), [teams, completions]);
  const ticker = useTicker(completions, teams);
  const phase = session?.phase ?? "lobby";
  const left = secondsLeft(session, now);
  const host = useSyncExternalStore(
    () => () => {},
    () => window.location.host,
    () => "",
  );

  if (galleryOpen && boss.length) return <Gallery items={boss} teams={teams} onClose={() => setGalleryOpen(false)} />;

  return (
    <div className="flex min-h-screen flex-col px-12 py-8">
      <header className="flex items-center gap-6">
        <Logo size={44} />
        <div className="ml-auto flex items-center gap-4">
          <span
            className={`rounded-full px-4 py-1.5 text-[15px] font-medium ${
              phase === "running" ? "bg-crimson text-white" : phase === "paused" ? "bg-warn/20 text-warn" : "bg-ink text-cream"
            }`}
          >
            {PHASE_LABEL[phase]}
          </span>
          {left !== null && (
            <span className="flex items-center gap-2 font-mono text-[44px] leading-none tabular-nums">
              <Timer size={34} className="text-ink-muted" />
              {formatClock(left)}
            </span>
          )}
        </div>
      </header>

      {phase === "lobby" ? (
        <div className="my-auto text-center">
          <h1 className="font-display text-[64px] leading-tight">Grab a laptop, pick a captain.</h1>
          <p className="mt-3 text-[22px] text-ink-muted">
            Go to <span className="font-mono text-crimson">{host}</span> and create your team.
          </p>
          <div className="mx-auto mt-12 flex max-w-5xl flex-wrap justify-center gap-3">
            {teams.map((t) => (
              <span key={t.id} className="animate-pop rounded-full border border-line bg-surface px-5 py-2.5 text-[20px]">
                {t.name}
              </span>
            ))}
            {teams.length === 0 && <span className="text-[18px] text-ink-muted">No teams yet.</span>}
          </div>
        </div>
      ) : (
        <>
          <div className="mt-8 mb-3 grid grid-cols-[64px_1fr_auto_150px] items-end gap-6 px-6 text-[13px] font-medium tracking-wider text-ink-muted uppercase">
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
                className={`grid grid-cols-[64px_1fr_auto_150px] items-center gap-6 rounded-2xl px-6 py-3.5 transition ${
                  i < 3 ? "bg-crimson/[0.07] ring-1 ring-crimson/15" : "bg-surface ring-1 ring-line"
                }`}
              >
                <span className={`font-display text-[34px] ${i < 3 ? "text-crimson" : "text-ink-muted"}`}>{i + 1}</span>
                <span className="truncate text-[26px] font-medium">{r.team.name}</span>
                <span className="flex gap-3">
                  {LEVELS.map((l) => {
                    const cleared = r.cleared.includes(l.id);
                    const skipped = r.skipped.includes(l.id);
                    return (
                      <span
                        key={l.id}
                        className={`size-9 rounded-full ${cleared ? "bg-crimson" : skipped ? "bg-line" : "border-2 border-line"}`}
                        title={`Level ${l.id}`}
                      />
                    );
                  })}
                </span>
                <span className="text-right text-[30px] font-medium tabular-nums">{r.points.toLocaleString()}</span>
              </li>
            ))}
          </ol>
          {rows.length === 0 && <p className="mt-10 text-center text-[20px] text-ink-muted">No teams yet.</p>}

          <footer className="mt-auto flex items-center gap-4 pt-8 text-[17px] text-ink-muted">
            <span>Max {MAX_POINTS.toLocaleString()} pts · hints cost 25%</span>
            {ticker && (
              <span key={ticker.key} className="animate-pop ml-auto rounded-full bg-ink px-5 py-2 text-cream">
                {ticker.text}
              </span>
            )}
            {(phase === "ended" || phase === "boss") && boss.length > 0 && (
              <button onClick={() => setGalleryOpen(true)} className="ml-auto rounded-full bg-crimson px-5 py-2 font-medium text-white">
                Boss designs ({boss.length}) →
              </button>
            )}
          </footer>
        </>
      )}
    </div>
  );
}

/** "Team X just cleared Level 6" for the newest completion. */
function useTicker(completions: { team_id: string; level: number; skipped: boolean; completed_at: string }[], teams: { id: string; name: string }[]) {
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

function Gallery({
  items,
  teams,
  onClose,
}: {
  items: { team_id: string; title: string; problem: string; workflow: unknown }[];
  teams: { id: string; name: string }[];
  onClose: () => void;
}) {
  const [i, setI] = useState(0);
  const item = items[Math.min(i, items.length - 1)];
  const team = teams.find((t) => t.id === item.team_id)?.name ?? "";
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setI((x) => Math.min(items.length - 1, x + 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items.length, onClose]);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-6 border-b border-line px-10 py-5">
        <div>
          <div className="text-[14px] font-medium tracking-wider text-crimson uppercase">
            {team} · {i + 1} of {items.length}
          </div>
          <h1 className="font-display text-[42px] leading-tight">{item.title}</h1>
          <p className="text-[20px] text-ink-muted">{item.problem}</p>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={() => setI(Math.max(0, i - 1))} className="rounded-full p-3 ring-1 ring-line hover:bg-surface" aria-label="Previous">
            <ChevronLeft size={26} />
          </button>
          <button onClick={() => setI(Math.min(items.length - 1, i + 1))} className="rounded-full p-3 ring-1 ring-line hover:bg-surface" aria-label="Next">
            <ChevronRight size={26} />
          </button>
          <button onClick={onClose} className="rounded-full px-5 ring-1 ring-line hover:bg-surface">
            Leaderboard
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1">
        <Canvas key={item.team_id} workflow={item.workflow as Workflow} readOnly palette={bossLevel.palette} />
      </div>
    </div>
  );
}
