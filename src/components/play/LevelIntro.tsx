"use client";

import { ArrowRight, CircleCheck, MousePointerClick, Play, Plus } from "lucide-react";
import type { Level } from "@/engine/types";
import { LEVELS } from "@/levels";
import { TIER_LABEL } from "../panels/BriefPanel";
import { Button } from "../ui";

const HOW = [
  { icon: Plus, title: "Add a trigger", text: "The event that starts everything, like a form being submitted." },
  { icon: MousePointerClick, title: "Add steps and set them up", text: "Click a step to fill it in. Drag from a dot to connect steps." },
  { icon: Play, title: "Run tests", text: "We feed it example data. All green means you pass." },
];

/** Shown the first time a team opens a level: the whole mission on one card. */
export function LevelIntro({ level, onStart }: { level: Level; onStart: () => void }) {
  return (
    <div className="absolute inset-0 z-40 grid place-items-center overflow-y-auto bg-ink/25 p-6 backdrop-blur-[2px]">
      <div className="animate-rise w-full max-w-[620px] rounded-lg bg-paper p-8 shadow-[0_24px_60px_rgb(46_31_31/0.2)] ring-1 ring-line">
        <div className="eyebrow">
          Level {level.id} of {LEVELS.length} · {TIER_LABEL[level.tier]} · {level.points} pts
        </div>
        <h1 className="display mt-2 text-[38px] leading-[1.05]">{level.title}</h1>

        <p className="mt-4 text-[16px] leading-relaxed text-ink-2">{level.scenario}</p>

        <div className="mt-5 rounded-lg bg-crimson-soft px-5 py-4">
          <div className="text-[12px] font-semibold tracking-[0.06em] text-crimson uppercase">Your task</div>
          <p className="mt-1 text-[17px] leading-snug font-semibold text-ink">{level.task}</p>
        </div>

        <div className="mt-5 text-[13px] font-semibold text-muted">You&apos;re done when:</div>
        <ul className="mt-2 space-y-2">
          {level.goals.map((g) => (
            <li key={g} className="flex gap-2.5 text-[14.5px] leading-snug text-ink-2">
              <CircleCheck size={18} className="mt-px shrink-0 text-faint" />
              {g}
            </li>
          ))}
        </ul>

        {level.id === 1 && (
          <div className="mt-6 grid grid-cols-3 gap-3 border-t border-line pt-6">
            {HOW.map((h, i) => (
              <div key={h.title} className="rounded-lg bg-cream p-3.5">
                <div className="flex items-center gap-2">
                  <span className="grid size-6 place-items-center rounded-full bg-ink text-[12px] font-semibold text-paper">{i + 1}</span>
                  <h.icon size={15} className="text-crimson" />
                </div>
                <div className="mt-2 text-[13.5px] font-semibold">{h.title}</div>
                <div className="mt-0.5 text-[12.5px] leading-snug text-muted">{h.text}</div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-7 flex items-center justify-between">
          <span className="text-[13px] text-muted">New skill: {level.skill}</span>
          <Button size="lg" onClick={onStart} autoFocus>
            Start building <ArrowRight size={17} />
          </Button>
        </div>
      </div>
    </div>
  );
}
