"use client";

import { Check, Lock, Timer } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { LEVELS } from "@/levels";
import type { Progress } from "@/lib/store";
import { Logo } from "./ui";

export function unlocked(progress: Progress, id: number) {
  return id === 1 || Boolean(progress.done[id - 1]) || Boolean(progress.done[id]);
}

interface Props {
  teamName: string;
  progress: Progress;
  clock: string | null;
  secondsLeft?: number | null;
  paused?: boolean;
  rank?: { place: number; of: number } | null;
  onPick?: (id: number) => void;
  right?: ReactNode;
}

export function TopBar({ teamName, progress, clock, secondsLeft, paused, rank, onPick, right }: Props) {
  const total = Object.values(progress.done).reduce((s, d) => s + d.points, 0);
  return (
    <header className="flex h-16 shrink-0 items-center gap-5 border-b border-line bg-paper px-5">
      <Logo compact />

      {onPick ? (
        <nav className="mx-auto flex items-center" aria-label="Levels">
          {LEVELS.map((l, i) => {
            const d = progress.done[l.id];
            const open = unlocked(progress, l.id);
            const current = progress.currentLevel === l.id;
            return (
              <Fragment key={l.id}>
                {i > 0 && <span className={`h-[2px] w-4 ${progress.done[l.id - 1] ? "bg-crimson/50" : "bg-line"}`} />}
                <button
                  disabled={!open}
                  onClick={() => onPick(l.id)}
                  title={open ? `Level ${l.id}: ${l.title}` : "Finish the previous level to unlock"}
                  className={`grid size-8 place-items-center rounded-full text-[13px] font-semibold transition ${
                    current
                      ? "bg-crimson text-paper ring-4 ring-crimson/15"
                      : d && !d.skipped
                        ? "bg-crimson-soft text-crimson hover:bg-crimson/20"
                        : d?.skipped
                          ? "bg-sand text-muted"
                          : open
                            ? "bg-paper text-crimson ring-1 ring-crimson/50 hover:bg-crimson-soft"
                            : "bg-paper text-faint ring-1 ring-line"
                  }`}
                >
                  {d && !d.skipped && !current ? <Check size={14} strokeWidth={3} /> : !open ? <Lock size={12} /> : l.id}
                </button>
              </Fragment>
            );
          })}
        </nav>
      ) : (
        <div className="mx-auto" />
      )}

      {clock !== null && (
        <div
          title="Time left"
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[14px] font-semibold tabular-nums ring-1 ${
            paused
              ? "bg-warn-soft text-warn ring-warn/30"
              : secondsLeft != null && secondsLeft <= 60
                ? "pulse-soft bg-crimson text-paper ring-crimson"
                : secondsLeft != null && secondsLeft <= 300
                  ? "bg-crimson-soft text-crimson ring-crimson/30"
                  : "bg-paper text-ink ring-line"
          }`}
        >
          <Timer size={15} />
          {clock}
          {paused && <span className="text-[12px] font-medium">paused</span>}
        </div>
      )}
      <div className="flex items-center overflow-hidden rounded-full bg-ink text-[14px] font-semibold text-paper tabular-nums">
        <span className="px-3.5 py-1.5">{total.toLocaleString()} pts</span>
        {rank && (
          <span title="Your place on the leaderboard" className="border-l border-paper/20 px-3 py-1.5 font-medium text-paper/80">
            #{rank.place} of {rank.of}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 border-l border-line pl-4">
        <span className="max-w-[160px] truncate text-[14px] font-medium" title={teamName}>
          {teamName}
        </span>
        {right}
      </div>
    </header>
  );
}
