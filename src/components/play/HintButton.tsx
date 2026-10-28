"use client";

import { Lightbulb } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Level } from "@/engine/types";
import { HINT_PENALTY } from "@/lib/scoring";
import { Button } from "../ui";

/** Top-bar hint control: shows revealed hints and reveals the next one (with its point cost). */
export function HintButton({ level, used, onReveal }: { level: Level; used: number; onReveal: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const cost = Math.round(level.points * HINT_PENALTY);
  const left = level.hints.length - used;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  if (level.hints.length === 0) return null;

  return (
    <div ref={root} className="relative">
      <button
        onClick={() => {
          setOpen(!open);
          setConfirm(false);
        }}
        aria-expanded={open}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[14px] font-medium transition ring-1 ${
          open ? "bg-warn-soft text-warn ring-warn/40" : "bg-paper text-ink ring-line hover:ring-warn/50"
        }`}
      >
        <Lightbulb size={15} className="text-warn" />
        Hint
        {used > 0 && <span className="rounded-full bg-warn px-1.5 text-[11px] font-semibold text-paper">{used}</span>}
      </button>

      {open && (
        <div className="animate-pop absolute top-full right-0 z-50 mt-2 w-[360px] rounded-lg bg-paper p-4 shadow-[0_12px_32px_rgb(46_31_31/0.16)] ring-1 ring-line">
          <div className="text-[12px] font-semibold tracking-[0.06em] text-muted uppercase">Hints for {level.title}</div>
          {used === 0 && <p className="mt-2 text-[13.5px] text-ink-2">Stuck? A hint points you in the right direction.</p>}
          <ol className="mt-2 space-y-2">
            {level.hints.slice(0, used).map((h, i) => (
              <li key={i} className="flex gap-2.5 rounded bg-warn-soft px-3 py-2.5 text-[13.5px] leading-snug text-ink">
                <span className="font-semibold text-warn">{i + 1}</span>
                <span>{h}</span>
              </li>
            ))}
          </ol>
          {left > 0 &&
            (confirm ? (
              <div className="mt-3 rounded bg-cream p-3 text-[13.5px]">
                {cost > 0 ? (
                  <p>
                    This makes the level worth <b>{cost} fewer points</b>.
                  </p>
                ) : (
                  <p>Hints are free on the demo.</p>
                )}
                <div className="mt-2.5 flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      onReveal();
                      setConfirm(false);
                    }}
                  >
                    Show hint {used + 1}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => setConfirm(true)} className="mt-3 w-full">
                <Lightbulb size={14} /> Reveal hint {used + 1} of {level.hints.length}
                {cost > 0 && <span className="text-muted">· −{cost} pts</span>}
              </Button>
            ))}
          {left === 0 && <p className="mt-3 text-[12.5px] text-muted">That&apos;s every hint for this level.</p>}
        </div>
      )}
    </div>
  );
}
