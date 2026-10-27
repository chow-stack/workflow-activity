"use client";

import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORY_LABEL, CATEGORY_ORDER, NODES } from "@/engine/nodes";
import type { NodeType } from "@/engine/types";
import { CATEGORY_COLOR, NODE_ICON } from "./icons";

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
        // Triggers come first; once there is one, they're hidden.
        if (cat === "trigger" ? hasTrigger : !hasTrigger) return false;
        return !needle || d.label.toLowerCase().includes(needle) || d.description.toLowerCase().includes(needle);
      }),
    })).filter((g) => g.items.length);
  }, [palette, q, hasTrigger]);

  const first = groups[0]?.items[0];

  return (
    <div className="absolute inset-0 z-30 flex items-start justify-end bg-black/20 p-4" onMouseDown={onClose}>
      <div
        className="animate-pop flex max-h-full w-[360px] flex-col overflow-hidden rounded-card bg-node text-node-text shadow-2xl ring-1 ring-node-border"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 pt-4">
          <div className="text-sm font-medium">{hasTrigger ? "What happens next?" : "What starts this workflow?"}</div>
          <button onClick={onClose} className="rounded p-1 text-node-muted hover:bg-node-hover hover:text-node-text" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <label className="mx-4 mt-3 flex items-center gap-2 rounded-lg bg-canvas px-3 py-2 ring-1 ring-node-border focus-within:ring-ember/60">
          <Search size={15} className="text-node-muted" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && first) onPick(first);
              if (e.key === "Escape") onClose();
            }}
            placeholder="Search steps…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-node-muted"
          />
        </label>
        <div className="mt-2 overflow-y-auto px-2 pb-3">
          {groups.length === 0 && <div className="px-3 py-6 text-center text-sm text-node-muted">No matching steps.</div>}
          {groups.map(({ cat, items }) => (
            <div key={cat} className="mt-2">
              <div className="px-3 pb-1 text-[11px] font-medium tracking-wider text-node-muted uppercase">{CATEGORY_LABEL[cat]}</div>
              {items.map((t) => {
                const d = NODES[t];
                const Icon = NODE_ICON[t];
                return (
                  <button
                    key={t}
                    onClick={() => onPick(t)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-node-hover"
                  >
                    <span
                      className="grid size-8 shrink-0 place-items-center rounded-lg"
                      style={{ background: `color-mix(in srgb, ${CATEGORY_COLOR[cat]} 18%, transparent)`, color: CATEGORY_COLOR[cat] }}
                    >
                      <Icon size={16} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13.5px]">{d.label}</span>
                      <span className="block truncate text-[11.5px] text-node-muted">{d.description}</span>
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
