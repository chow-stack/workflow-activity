"use client";

import { Hourglass, LogOut, Pause, Trophy, WifiOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { LEVELS, levelById } from "@/levels";
import { formatClock, secondsLeft, useLeaderboardData, useNow, useSession } from "@/lib/live";
import { standings } from "@/lib/scoring";
import { KEYS, load, remove } from "@/lib/storage";
import { usePlay, type Team } from "@/lib/store";
import { fetchDone, syncDone } from "@/lib/teams";
import { ScreenGuard } from "../ScreenGuard";
import { TopBar, unlocked } from "../TopBar";
import { Workspace } from "./Workspace";

export function PlayScreen() {
  const router = useRouter();
  const s = usePlay();
  const { session, offline } = useSession();
  const now = useNow();
  const [ready, setReady] = useState(false);
  const board = useLeaderboardData();
  const myId = s.team?.id;
  const rank = useMemo(() => {
    const rows = standings(board.teams, board.completions);
    const i = rows.findIndex((r) => r.team.id === myId);
    return i >= 0 ? { place: i + 1, of: rows.length } : null;
  }, [board, myId]);

  useEffect(() => {
    const team = load<Team | null>(KEYS.team, null);
    if (!team) {
      router.replace("/");
      return;
    }
    fetchDone(team.id).then((done) => {
      usePlay.getState().init(team, done ?? undefined);
      setReady(true);
      syncDone(team.id, usePlay.getState().progress);
    });
  }, [router]);

  // When play resumes (e.g. after a wifi drop or a pause), push any local completions.
  useEffect(() => {
    const st = usePlay.getState();
    if (ready && st.team && session?.phase === "running") syncDone(st.team.id, st.progress);
  }, [ready, session?.phase]);

  if (!ready || !s.team || (!session && !offline)) {
    return <Centered>Loading…</Centered>;
  }

  const phase = offline ? "running" : session!.phase;
  const left = secondsLeft(session, now);
  const clock = phase === "running" || phase === "paused" ? formatClock(left) : null;
  const leave = () => {
    remove(KEYS.team);
    router.replace("/");
  };
  const level = levelById(Math.min(s.progress.currentLevel, LEVELS.length))!;
  const total = Object.values(s.progress.done).reduce((a, d) => a + d.points, 0);

  return (
    <ScreenGuard>
      <div className="flex h-screen flex-col">
        <TopBar
          teamName={s.team.name}
          progress={s.progress}
          clock={clock}
          secondsLeft={left}
          paused={phase === "paused"}
          rank={offline || phase === "lobby" ? null : rank}
          onPick={phase === "running" || phase === "paused" ? (id) => unlocked(s.progress, id) && s.setLevel(id) : undefined}
          right={
            <button onClick={leave} title="Switch player" className="rounded-full p-1.5 text-muted hover:bg-sand hover:text-ink">
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
            Waiting for the host to start. Keep this screen open; Level 1 appears here when the clock starts.
          </Centered>
        )}
        {(phase === "running" || phase === "paused") && (
          <div className="relative flex min-h-0 flex-1">
            <Workspace key={level.id} level={level} online={!offline} />
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
            You finished with {total.toLocaleString()} points. Check the big screen for the final standings.
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
