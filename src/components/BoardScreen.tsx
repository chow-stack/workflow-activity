"use client";

import { ArrowRight, Check, Timer } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { DEMO, LEVELS, MAX_POINTS } from "@/levels";
import { formatClock, secondsLeft, useLeaderboardData, useNow, useRoom } from "@/lib/live";
import { standings } from "@/lib/scoring";
import { KEYS, load } from "@/lib/storage";
import { normalizeCode } from "@/lib/supabase";
import { Button, Logo } from "./ui";

const TOP = 10; // rows that fit on a projector

const PHASE_LABEL = { lobby: "Joining", demo: "Demo", running: "Live", paused: "Paused", ended: "Final standings" } as const;

const useOrigin = () =>
  useSyncExternalStore(
    () => () => {},
    () => window.location.host,
    () => "",
  );

/** Projector view for one room: `/board?room=CODE`. Falls back to the room this laptop hosts. */
export function BoardScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const fromUrl = normalizeCode(params.get("room") ?? "");
  const [code, setCode] = useState<string | null>(fromUrl || null);

  useEffect(() => {
    if (fromUrl) return;
    const hosted = load<{ code: string } | null>(KEYS.host, null);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (hosted?.code) setCode(hosted.code);
  }, [fromUrl]);

  if (!code) return <PickRoom onPick={(c) => router.replace(`/board?room=${c}`)} />;
  return <Board code={code} />;
}

function PickRoom({ onPick }: { onPick: (code: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="grid min-h-screen place-items-center bg-paper p-8">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (value.length === 5) onPick(value);
        }}
        className="w-full max-w-sm text-center"
      >
        <Logo />
        <h1 className="display mt-8 text-[32px]">Which room?</h1>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(normalizeCode(e.target.value))}
          placeholder="CODE"
          className="mt-6 w-full rounded-lg border-2 border-line-strong bg-paper py-3 text-center font-mono text-[30px] font-semibold tracking-[0.35em] uppercase outline-none focus:border-ink"
        />
        <Button size="lg" disabled={value.length !== 5} className="mt-4 w-full">
          Show board <ArrowRight size={17} />
        </Button>
      </form>
    </div>
  );
}

function Board({ code }: { code: string }) {
  const { room } = useRoom(code);
  const { teams, completions } = useLeaderboardData(code);
  const now = useNow();
  const host = useOrigin();
  const rows = useMemo(() => standings(teams, completions), [teams, completions]);
  const demoDone = useMemo(() => new Set(completions.filter((c) => c.level === 0).map((c) => c.team_id)), [completions]);
  const ticker = useTicker(completions, teams);
  const phase = room?.phase ?? "lobby";
  const left = secondsLeft(room, now);

  return (
    <div className="flex min-h-screen flex-col bg-paper px-12 py-8">
      <header className="flex items-center gap-6">
        <Logo />
        {phase !== "lobby" && (
          <span className="rounded-full bg-cream px-4 py-1.5 text-[18px] ring-1 ring-line">
            {host}/ · <b className="font-mono tracking-wider">{code}</b>
          </span>
        )}
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

      {phase === "lobby" && (
        <div className="my-auto text-center">
          <p className="text-[28px] text-ink-2">
            Go to <span className="font-semibold text-ink">{host}</span> and enter
          </p>
          <div className="mx-auto mt-4 inline-block rounded-[32px] bg-cream px-14 py-6 ring-1 ring-line">
            <div className="font-mono text-[120px] leading-none font-semibold tracking-[0.18em]">{code}</div>
          </div>
          <div className="mx-auto mt-12 flex max-w-5xl flex-wrap justify-center gap-3">
            {teams.map((t) => (
              <span key={t.id} className="animate-pop rounded-full bg-cream px-5 py-2.5 text-[20px] font-medium ring-1 ring-line">
                {t.name}
              </span>
            ))}
            {teams.length === 0 && <span className="text-[20px] text-muted">Waiting for the first player…</span>}
          </div>
        </div>
      )}

      {phase === "demo" && (
        <div className="my-auto">
          <div className="text-center">
            <div className="eyebrow">Warm-up together</div>
            <h1 className="display mt-3 text-[56px] leading-tight">{DEMO.title}</h1>
            <p className="mx-auto mt-3 max-w-3xl text-[24px] text-ink-2">{DEMO.task}</p>
          </div>
          <div className="mx-auto mt-10 max-w-3xl">
            <div className="flex items-center gap-4">
              <div className="h-4 flex-1 overflow-hidden rounded-full bg-sand">
                <div className="h-full bg-pass transition-all" style={{ width: `${teams.length ? (demoDone.size / teams.length) * 100 : 0}%` }} />
              </div>
              <span className="text-[26px] font-semibold tabular-nums">
                {demoDone.size}/{teams.length}
              </span>
            </div>
            <div className="mt-8 flex flex-wrap justify-center gap-2.5">
              {teams.map((t) => {
                const done = demoDone.has(t.id);
                return (
                  <span
                    key={t.id}
                    className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-[18px] font-medium ${
                      done ? "bg-pass text-paper" : "bg-cream text-ink-2 ring-1 ring-line"
                    }`}
                  >
                    {done && <Check size={17} strokeWidth={3} />}
                    {t.name}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {(phase === "running" || phase === "paused" || phase === "ended") && (
        <>
          <div className="mt-10 mb-3 grid grid-cols-[64px_1fr_auto_150px] items-end gap-6 px-6 text-[13px] font-semibold tracking-[0.06em] text-muted uppercase">
            <span>#</span>
            <span>Player</span>
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
            {rows.slice(0, TOP).map((r, i) => (
              <li
                key={r.team.id}
                className={`grid grid-cols-[64px_1fr_auto_150px] items-center gap-6 rounded-lg px-6 py-3 ${
                  i === 0 && r.points > 0 ? "bg-crimson-soft ring-2 ring-crimson/40" : "bg-paper ring-1 ring-line"
                }`}
              >
                <span className={`display text-[34px] ${i < 3 && r.points > 0 ? "text-crimson" : "text-faint"}`}>{i + 1}</span>
                <span className="truncate text-[24px] font-semibold">{r.team.name}</span>
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
          {rows.length === 0 && <p className="mt-10 text-center text-[20px] text-muted">No players yet.</p>}
          {rows.length > TOP && (
            <p className="mt-3 px-6 text-[17px] text-muted">
              + {rows.length - TOP} more {rows.length - TOP === 1 ? "player" : "players"} · check your own screen for your rank
            </p>
          )}

          <footer className="mt-auto flex items-center gap-4 pt-8 text-[17px] text-muted">
            <span>
              {rows.length} {rows.length === 1 ? "player" : "players"} · max {MAX_POINTS.toLocaleString()} pts · hints cost 25%
            </span>
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

/** "Maya just cleared Level 6" for the newest completion. */
function useTicker(
  completions: { team_id: string; level: number; skipped: boolean; completed_at: string }[],
  teams: { id: string; name: string }[],
) {
  const seen = useRef<number>(0);
  const [msg, setMsg] = useState<{ key: string; text: string } | null>(null);
  useEffect(() => {
    const latest = completions
      .filter((c) => !c.skipped && c.level > 0)
      .sort((a, b) => Date.parse(b.completed_at) - Date.parse(a.completed_at))[0];
    if (!latest) return;
    const t = Date.parse(latest.completed_at);
    if (t <= seen.current) return;
    const first = seen.current === 0;
    seen.current = t;
    if (first) return;
    const name = teams.find((x) => x.id === latest.team_id)?.name ?? "Someone";
    setMsg({ key: `${latest.team_id}-${latest.level}`, text: `${name} just cleared Level ${latest.level}` });
    const id = window.setTimeout(() => setMsg(null), 8000);
    return () => window.clearTimeout(id);
  }, [completions, teams]);
  return msg;
}
