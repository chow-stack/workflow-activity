"use client";

import { Check, Lock, Timer } from "lucide-react";
import type { ReactNode } from "react";
import { LEVELS } from "@/levels";
import type { Progress } from "@/lib/store";

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-mark.png" alt="" width={size} height={Math.round(size * 0.73)} />
      <div className="leading-none">
        <div className="text-[10px] font-semibold tracking-[0.14em] text-crimson uppercase">Gen AI Club</div>
        <div className="font-display text-[17px]">Workflow Lab</div>
      </div>
    </div>
  );
}

export function unlocked(progress: Progress, id: number) {
  return id === 1 || Boolean(progress.done[id - 1]) || Boolean(progress.done[id]);
}

interface Props {
  teamName: string;
  progress: Progress;
  clock: string | null;
  paused?: boolean;
  onPick?: (id: number) => void;
  right?: ReactNode;
}

export function TopBar({ teamName, progress, clock, paused, onPick, right }: Props) {
  const total = Object.values(progress.done).reduce((s, d) => s + d.points, 0);
  return (
    <header className="flex h-[60px] shrink-0 items-center gap-6 border-b border-line bg-cream px-5">
      <Logo />
      <div className="h-7 w-px bg-line" />
      <div className="max-w-[200px] truncate text-[14px] font-medium" title={teamName}>
        {teamName}
      </div>

      {onPick && (
        <nav className="mx-auto flex items-center gap-1.5" aria-label="Levels">
          {LEVELS.map((l) => {
            const d = progress.done[l.id];
            const open = unlocked(progress, l.id);
            const current = progress.currentLevel === l.id;
            return (
              <button
                key={l.id}
                disabled={!open}
                onClick={() => onPick(l.id)}
                title={open ? `Level ${l.id}: ${l.title}` : "Locked"}
                className={`grid size-8 place-items-center rounded-full text-[13px] font-medium transition ${
                  current
                    ? "bg-crimson text-white ring-4 ring-crimson/15"
                    : d && !d.skipped
                      ? "bg-crimson/10 text-crimson hover:bg-crimson/20"
                      : d?.skipped
                        ? "bg-line text-ink-muted"
                        : open
                          ? "border border-crimson/40 text-crimson hover:bg-crimson/5"
                          : "border border-line text-ink-muted/50"
                }`}
              >
                {d && !d.skipped && !current ? <Check size={14} strokeWidth={3} /> : !open ? <Lock size={12} /> : l.id}
              </button>
            );
          })}
        </nav>
      )}
      {!onPick && <div className="mx-auto" />}

      {clock !== null && (
        <div className={`flex items-center gap-1.5 font-mono text-[15px] tabular-nums ${paused ? "text-warn" : ""}`}>
          <Timer size={16} className="text-ink-muted" />
          {clock}
          {paused && <span className="font-sans text-[12px]">paused</span>}
        </div>
      )}
      <div className="rounded-full bg-ink px-3 py-1 text-[13px] font-medium text-cream tabular-nums">{total.toLocaleString()} pts</div>
      {right}
    </header>
  );
}
