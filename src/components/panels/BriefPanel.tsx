"use client";

import { Lightbulb, SkipForward } from "lucide-react";
import { useState } from "react";
import type { Level } from "@/engine/types";
import { HINT_PENALTY, pointsFor } from "@/lib/scoring";
import { InputPreview } from "./DataPreview";

const TIER_LABEL = { easy: "Easy", medium: "Medium", hard: "Hard", expert: "Expert", boss: "Boss" } as const;

interface Props {
  level: Level;
  hintsUsed: number;
  done?: { points: number; skipped: boolean };
  onHint: () => void;
  onSkip: () => void;
}

export function BriefPanel({ level, hintsUsed, done, onHint, onSkip }: Props) {
  const [confirm, setConfirm] = useState<"hint" | "skip" | null>(null);
  const visible = level.tests.filter((t) => !t.hidden);
  const hidden = level.tests.length - visible.length;
  const penalty = Math.round(level.points * HINT_PENALTY);

  return (
    <aside className="flex h-full w-[340px] shrink-0 flex-col overflow-y-auto border-r border-line bg-cream">
      <div className="px-6 pt-6">
        <div className="flex items-center gap-2 text-[11.5px] font-medium tracking-wider text-ink-muted uppercase">
          <span>Level {level.id}</span>
          <span className="size-1 rounded-full bg-ink-muted/50" />
          <span>{TIER_LABEL[level.tier]}</span>
          <span className="ml-auto rounded-full bg-crimson/[0.08] px-2 py-0.5 text-crimson normal-case tracking-normal">
            {pointsFor(level.points, hintsUsed)} pts
          </span>
        </div>
        <h1 className="mt-2 font-display text-[30px] leading-[1.1] font-medium">{level.title}</h1>
        <p className="mt-1 text-[13px] text-crimson">{level.teaches}</p>
        <p className="mt-4 text-[14.5px] leading-relaxed">{level.brief}</p>

        {done && (
          <div className={`mt-4 rounded-lg px-3 py-2 text-[13px] ${done.skipped ? "bg-line/60 text-ink-muted" : "bg-pass/10 text-pass"}`}>
            {done.skipped ? "Skipped. You can still try it for practice." : `Cleared for ${done.points} points.`}
          </div>
        )}

        <h2 className="mt-6 mb-2 text-[12px] font-medium tracking-wider text-ink-muted uppercase">Goals</h2>
        <ul className="space-y-1.5">
          {level.goals.map((g) => (
            <li key={g} className="flex gap-2 text-[13.5px] leading-snug">
              <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-crimson" />
              {g}
            </li>
          ))}
        </ul>

        <h2 className="mt-6 mb-2 text-[12px] font-medium tracking-wider text-ink-muted uppercase">Sample data</h2>
        <div className="space-y-4">
          {visible.slice(0, 3).map((t) => (
            <div key={t.id}>
              <div className="mb-1 text-[12.5px] font-medium">{t.label}</div>
              <InputPreview input={t.input} />
            </div>
          ))}
          {hidden > 0 && (
            <p className="text-[12px] text-ink-muted">
              + {hidden} hidden {hidden === 1 ? "test" : "tests"} with edge cases.
            </p>
          )}
        </div>
      </div>

      <div className="mt-auto border-t border-line px-6 py-5">
        {level.hints.slice(0, hintsUsed).map((h, i) => (
          <div key={i} className="mb-3 flex gap-2 rounded-lg border border-warn/30 bg-warn/[0.07] px-3 py-2.5 text-[13px] leading-snug">
            <Lightbulb size={15} className="mt-0.5 shrink-0 text-warn" />
            <span>{h}</span>
          </div>
        ))}

        {confirm ? (
          <div className="animate-pop rounded-lg border border-line bg-surface p-3 text-[13px]">
            {confirm === "hint" ? (
              <p>
                Use hint {hintsUsed + 1}? This level will be worth <b>{penalty} fewer points</b>.
              </p>
            ) : (
              <p>Skip this level? You&apos;ll get 0 points for it and move on.</p>
            )}
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => {
                  if (confirm === "hint") onHint();
                  else onSkip();
                  setConfirm(null);
                }}
                className="rounded-lg bg-crimson px-3 py-1.5 font-medium text-white hover:bg-crimson-dark"
              >
                {confirm === "hint" ? "Show hint" : "Skip level"}
              </button>
              <button onClick={() => setConfirm(null)} className="rounded-lg px-3 py-1.5 text-ink-muted hover:bg-line/60">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          !done && (
            <div className="flex gap-2">
              {hintsUsed < level.hints.length && (
                <button
                  onClick={() => setConfirm("hint")}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] font-medium hover:border-warn/50"
                >
                  <Lightbulb size={15} className="text-warn" />
                  Hint {hintsUsed + 1} of {level.hints.length}
                  <span className="text-ink-muted">−{penalty}</span>
                </button>
              )}
              {hintsUsed >= level.hints.length && (
                <button
                  onClick={() => setConfirm("skip")}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] font-medium text-ink-muted hover:text-ink"
                >
                  <SkipForward size={15} /> Skip level
                </button>
              )}
            </div>
          )
        )}
      </div>
    </aside>
  );
}
