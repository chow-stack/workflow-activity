"use client";

import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORY_LABEL, CATEGORY_ORDER, NODES } from "@/engine/nodes";
import type { NodeType } from "@/engine/types";
import { NODE_ICON, tileStyle } from "./icons";

interface Props {
  palette: NodeType[];
  hasTrigger: boolean;
  onPick: (type: NodeType) => void;
  onClose: () => void;
}

export function AddNodeMenu({ palette, hasTrigger, onPick, onClose }: Props) {
  const [q, setQ] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return CATEGORY_ORDER.map((cat) => ({
      cat,
      items: palette.filter((t) => {
        const d = NODES[t];
        if (d.category !== cat) return false;
        // Until there's a trigger, only triggers are offered; after that, triggers are hidden.
        if (cat === "trigger" ? hasTrigger : !hasTrigger) return false;
        return !needle || d.label.toLowerCase().includes(needle) || d.description.toLowerCase().includes(needle);
      }),
    })).filter((g) => g.items.length);
  }, [palette, q, hasTrigger]);

  const first = groups[0]?.items[0];

  return (
    <div className="absolute inset-0 z-30 flex items-start justify-center bg-ink/10 p-6 pt-16" onMouseDown={onClose}>
      <div
        className="animate-pop flex max-h-full w-[440px] flex-col overflow-hidden rounded-lg bg-paper shadow-[0_12px_40px_rgb(46_31_31/0.16)] ring-1 ring-line"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 pt-5">
          <div>
            <div className="display text-[20px]">{hasTrigger ? "Add a step" : "Choose a trigger"}</div>
            <div className="mt-0.5 text-[13px] text-muted">
              {hasTrigger ? "What should happen next?" : "A trigger is the event that starts your workflow."}
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted hover:bg-sand hover:text-ink" aria-label="Close">
            <X size={17} />
          </button>
        </div>
        <label className="mx-5 mt-4 flex items-center gap-2 rounded border border-line-strong bg-paper px-3 py-2.5 focus-within:border-ink">
          <Search size={15} className="text-faint" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && first) onPick(first);
              if (e.key === "Escape") onClose();
            }}
            placeholder="Search"
            className="w-full bg-transparent text-[14px] outline-none placeholder:text-faint"
          />
        </label>
        <div className="mt-2 overflow-y-auto px-3 pb-4">
          {groups.length === 0 && <div className="px-3 py-6 text-center text-[14px] text-muted">Nothing matches that.</div>}
          {groups.map(({ cat, items }) => (
            <div key={cat} className="mt-3">
              <div className="px-2 pb-1.5 text-[11.5px] font-semibold tracking-[0.06em] text-muted uppercase">{CATEGORY_LABEL[cat]}</div>
              {items.map((t) => {
                const d = NODES[t];
                const Icon = NODE_ICON[t];
                return (
                  <button
                    key={t}
                    onClick={() => onPick(t)}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-cream"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg" style={tileStyle(cat)}>
                      <Icon size={17} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[14px] font-medium">{d.label}</span>
                      <span className="block truncate text-[12.5px] text-muted">{d.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
