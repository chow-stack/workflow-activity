"use client";

import { ChevronDown, CircleCheck, Lightbulb, SkipForward, Target, TriangleAlert } from "lucide-react";
import { useState } from "react";
import type { Level } from "@/engine/types";
import { LEVELS } from "@/levels";
import { HINT_PENALTY, pointsFor } from "@/lib/scoring";
import { Button } from "../ui";
import { InputPreview } from "./DataPreview";

export const TIER_LABEL = { easy: "Easy", medium: "Medium", hard: "Hard", expert: "Expert" } as const;

interface Props {
  level: Level;
  hintsUsed: number;
  done?: { points: number; skipped: boolean };
  onHint: () => void;
  onSkip: () => void;
}

/** Left panel: what's going on, what to build, what "done" means, sample data, hints. */
export function BriefPanel({ level, hintsUsed, done, onHint, onSkip }: Props) {
  const [confirm, setConfirm] = useState<"hint" | "skip" | null>(null);
  const [showData, setShowData] = useState(true);
  const visible = level.tests.filter((t) => !t.hidden);
  const hidden = level.tests.length - visible.length;
  const penalty = Math.round(level.points * HINT_PENALTY);

  return (
    <aside className="flex h-full w-[360px] shrink-0 flex-col overflow-y-auto border-r border-line bg-cream">
      <div className="px-6 pt-6 pb-5">
        <div className="eyebrow">
          Level {level.id} of {LEVELS.length}
        </div>
        <h1 className="display mt-1.5 text-[28px] leading-[1.1]">{level.title}</h1>
        <div className="mt-3 flex flex-wrap gap-1.5 text-[12px] font-medium">
          <span className="rounded bg-paper px-2 py-1 ring-1 ring-line">{TIER_LABEL[level.tier]}</span>
          <span className="rounded bg-paper px-2 py-1 ring-1 ring-line">{pointsFor(level.points, hintsUsed)} pts</span>
          <span className="rounded bg-crimson-soft px-2 py-1 text-crimson">New: {level.skill}</span>
        </div>
      </div>

      <div className="space-y-3 px-4">
        {done && (
          <div className={`rounded-lg px-4 py-3 text-[13.5px] font-medium ${done.skipped ? "bg-sand text-muted" : "bg-pass-soft text-pass"}`}>
            {done.skipped ? "Skipped. You can still try it for practice." : `Cleared for ${done.points} points.`}
          </div>
        )}

        <section className="rounded-lg bg-paper px-4 py-4 ring-1 ring-line">
          <h2 className="text-[12px] font-semibold tracking-[0.06em] text-muted uppercase">The situation</h2>
          <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-2">{level.scenario}</p>
        </section>

        <section className="rounded-lg bg-paper px-4 py-4 ring-2 ring-crimson/70">
          <h2 className="flex items-center gap-1.5 text-[12px] font-semibold tracking-[0.06em] text-crimson uppercase">
            <Target size={14} /> Your task
          </h2>
          <p className="mt-1.5 text-[15.5px] leading-snug font-semibold text-ink">{level.task}</p>
          <div className="mt-4 text-[12px] font-semibold text-muted">You&apos;re done when:</div>
          <ul className="mt-1.5 space-y-2">
            {level.goals.map((g) => (
              <li key={g} className="flex gap-2 text-[13.5px] leading-snug text-ink-2">
                <CircleCheck size={16} className={`mt-px shrink-0 ${done && !done.skipped ? "text-pass" : "text-faint"}`} />
                {g}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg bg-paper ring-1 ring-line">
          <button onClick={() => setShowData(!showData)} className="flex w-full items-center justify-between px-4 py-3 text-left">
            <span>
              <span className="block text-[12px] font-semibold tracking-[0.06em] text-muted uppercase">Example data</span>
              <span className="block text-[12.5px] text-muted">What your workflow will receive</span>
            </span>
            <ChevronDown size={17} className={`text-muted transition ${showData ? "rotate-180" : ""}`} />
          </button>
          {showData && (
            <div className="space-y-4 border-t border-line px-4 py-4">
              {visible.slice(0, 2).map((t) => (
                <div key={t.id}>
                  <div className="mb-1.5 text-[13px] font-medium">{t.label}</div>
                  <InputPreview input={t.input} />
                </div>
              ))}
              <p className="text-[12.5px] text-muted">
                Your workflow is checked against {level.tests.length} {level.tests.length === 1 ? "test" : "tests"}
                {hidden > 0 && <>, including {hidden} hidden {hidden === 1 ? "one" : "ones"} with tricky cases</>}.
              </p>
            </div>
          )}
        </section>
      </div>

      <div className="mt-auto px-4 pt-6 pb-5">
        {level.hints.slice(0, hintsUsed).map((h, i) => (
          <div key={i} className="mb-3 flex gap-2.5 rounded-lg bg-warn-soft px-3.5 py-3 text-[13.5px] leading-snug text-ink-2">
            <Lightbulb size={16} className="mt-0.5 shrink-0 text-warn" />
            <span>
              <b className="font-semibold text-ink">Hint {i + 1}:</b> {h}
            </span>
          </div>
        ))}

        {confirm ? (
          <div className="animate-pop rounded-lg bg-paper p-4 text-[13.5px] ring-1 ring-line">
            <div className="flex gap-2">
              <TriangleAlert size={16} className="mt-0.5 shrink-0 text-warn" />
              {confirm === "hint" ? (
                <p>
                  A hint makes this level worth <b>{penalty} fewer points</b>.
                </p>
              ) : (
                <p>Skipping gives 0 points for this level and unlocks the next one.</p>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  if (confirm === "hint") onHint();
                  else onSkip();
                  setConfirm(null);
                }}
              >
                {confirm === "hint" ? "Show hint" : "Skip level"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          !done && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] text-muted">Stuck?</span>
              {hintsUsed < level.hints.length ? (
                <Button size="sm" variant="secondary" onClick={() => setConfirm("hint")}>
                  <Lightbulb size={14} /> Get hint {hintsUsed + 1} of {level.hints.length}
                </Button>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => setConfirm("skip")}>
                  <SkipForward size={14} /> Skip level
                </Button>
              )}
            </div>
          )
        )}
      </div>
    </aside>
  );
}
