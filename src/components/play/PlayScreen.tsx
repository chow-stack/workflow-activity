"use client";

import { Hourglass, LogOut, Pause, Trophy, WifiOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { DEMO, LEVELS, levelById } from "@/levels";
import { formatClock, secondsLeft, useLeaderboardData, useNow, useRoom } from "@/lib/live";
import { standings } from "@/lib/scoring";
import { KEYS, load, remove } from "@/lib/storage";
import { usePlay, type Team } from "@/lib/store";
import { fetchDone, syncDone } from "@/lib/teams";
import { ScreenGuard } from "../ScreenGuard";
import { TopBar, unlocked } from "../TopBar";
import { HintButton } from "./HintButton";
import { Workspace } from "./Workspace";

const firstOpen = (done: Record<number, unknown>) => LEVELS.find((l) => !done[l.id])?.id ?? LEVELS.length;

export function PlayScreen() {
  const router = useRouter();
  const s = usePlay();
  const [team, setTeam] = useState<Team | null>(null);
  const { room, offline, missing } = useRoom(team?.room ?? null);
  const now = useNow();
  const [ready, setReady] = useState(false);
  const board = useLeaderboardData(team?.room ?? null);
  const myId = team?.id;
  const rank = useMemo(() => {
    const rows = standings(board.teams, board.completions);
    const i = rows.findIndex((r) => r.team.id === myId);
    return i >= 0 ? { place: i + 1, of: rows.length } : null;
  }, [board, myId]);

  useEffect(() => {
    const saved = load<Team | null>(KEYS.team, null);
    if (!saved?.room) {
      router.replace("/");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTeam(saved);
    fetchDone(saved.id).then((done) => {
      usePlay.getState().init(saved, done ?? undefined);
      setReady(true);
      syncDone(saved, usePlay.getState().progress);
    });
  }, [router]);

  const leave = () => {
    remove(KEYS.team);
    router.replace("/");
  };

  // The room was deleted or reset: go back to the join screen.
  useEffect(() => {
    if (missing) leave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missing]);

  const phase = offline ? "running" : (room?.phase ?? null);

  // Demo phase shows the warm-up; once the clock starts, jump to the first open level.
  useEffect(() => {
    if (!ready) return;
    const st = usePlay.getState();
    if (phase === "demo" && st.progress.currentLevel !== 0) st.setLevel(0);
    if ((phase === "running" || phase === "paused") && st.progress.currentLevel === 0) st.setLevel(firstOpen(st.progress.done));
    if (phase === "running" && st.team) syncDone(st.team, st.progress);
  }, [ready, phase]);

  if (!ready || !s.team || !phase) return <Centered>Loading…</Centered>;

  const left = secondsLeft(room, now);
  const clock = phase === "running" || phase === "paused" ? formatClock(left) : null;
  const inDemo = phase === "demo";
  const level = inDemo ? DEMO : levelById(Math.max(1, Math.min(s.progress.currentLevel, LEVELS.length)))!;
  const total = Object.values(s.progress.done).reduce((a, d) => a + d.points, 0);
  const working = inDemo || phase === "running" || phase === "paused";

  return (
    <ScreenGuard>
      <div className="flex h-screen flex-col">
        <TopBar
          teamName={s.team.name}
          progress={s.progress}
          clock={clock}
          secondsLeft={left}
          paused={phase === "paused"}
          showPoints={!inDemo && phase !== "lobby"}
          rank={offline || !working || inDemo ? null : rank}
          onPick={phase === "running" || phase === "paused" ? (id) => unlocked(s.progress, id) && s.setLevel(id) : undefined}
          center={
            inDemo ? (
              <span className="rounded-full bg-crimson-soft px-4 py-1.5 text-[14px] font-semibold text-crimson">
                Warm-up · follow along on the big screen
              </span>
            ) : undefined
          }
          hint={working ? <HintButton level={level} used={s.progress.hints[level.id] ?? 0} onReveal={s.takeHint} /> : undefined}
          right={
            <button onClick={leave} title="Leave this room" className="rounded-full p-1.5 text-muted hover:bg-sand hover:text-ink">
              <LogOut size={15} />
            </button>
          }
        />
        {offline && (
          <div className="flex items-center justify-center gap-2 bg-warn-soft py-1.5 text-[13px] text-warn">
            <WifiOff size={14} /> Offline. Progress is saved on this laptop and will sync when the connection is back.
          </div>
        )}

        {phase === "lobby" && (
          <Centered icon={<Hourglass size={26} />} title={`You're in, ${s.team.name}.`}>
            Look at the big screen. We&apos;ll start with a quick warm-up together.
          </Centered>
        )}
        {working && (
          <div className="relative flex min-h-0 flex-1">
            <Workspace
              key={level.id}
              level={level}
              online={!offline}
              doneNote="Nice work. Level 1 opens here when the host starts the clock."
            />
            {phase === "paused" && (
              <div className="absolute inset-0 z-50 grid place-items-center bg-paper/85 backdrop-blur-sm">
                <Centered icon={<Pause size={26} />} title="Paused">
                  Eyes up front. The clock is stopped.
                </Centered>
              </div>
            )}
          </div>
        )}
        {phase === "ended" && (
          <Centered icon={<Trophy size={26} />} title="That's time!">
            You finished with {total.toLocaleString()} points{rank ? `, #${rank.place} of ${rank.of}` : ""}. Check the big screen for the final
            standings.
          </Centered>
        )}
      </div>
    </ScreenGuard>
  );
}

export function Centered({ icon, title, children }: { icon?: ReactNode; title?: string; children: ReactNode }) {
  return (
    <div className="grid flex-1 place-items-center p-8">
      <div className="max-w-md text-center">
        {icon && <div className="mx-auto mb-5 grid size-14 place-items-center rounded-full bg-crimson-soft text-crimson">{icon}</div>}
        {title && <h1 className="display text-[32px] leading-tight">{title}</h1>}
        <p className="mt-2 text-[15.5px] leading-relaxed text-muted">{children}</p>
      </div>
    </div>
  );
}
