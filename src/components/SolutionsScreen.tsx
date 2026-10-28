"use client";

import { ArrowLeft, ArrowRight, Lock, Sparkles, TriangleAlert } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { topoOrder } from "@/engine/graph";
import { NODES, type ExtractConfig, type SwitchConfig } from "@/engine/nodes";
import type { Config, WfNode } from "@/engine/types";
import { LEVELS } from "@/levels";
import { autoLayout } from "@/lib/layout";
import { useRoom } from "@/lib/live";
import { normalizeCode } from "@/lib/supabase";
import { Canvas } from "./canvas/Canvas";
import { CATEGORY_WORD, NODE_ICON, tileStyle } from "./canvas/icons";
import { Button, Logo } from "./ui";

const s = (c: Config, k: string) => (typeof c[k] === "string" ? (c[k] as string) : "");
const q = (t: string) => `“${t}”`;

/** The settings that make each step work, in plain words. */
function details(n: WfNode): string {
  const c = n.config;
  switch (n.type) {
    case "data.readSheet":
      return `Sheet: ${s(c, "sheet")}`;
    case "data.forEach":
      return `Loops over: ${s(c, "field")}`;
    case "data.combine":
      return [s(c, "lineTemplate") && `Each line: ${q(s(c, "lineTemplate"))}`, s(c, "sumField") && `Adds up: ${s(c, "sumField")}`]
        .filter(Boolean)
        .join(" · ");
    case "logic.switch":
      return `Routes on ${(c as unknown as SwitchConfig).field}: ${(c as unknown as SwitchConfig).rules.join(", ")}`;
    case "ai.classify":
      return `Reads ${s(c, "field")} · labels: ${s(c, "labels")}`;
    case "ai.extract": {
      const e = c as unknown as ExtractConfig;
      return `Reads ${e.field} · pulls out ${e.fields.map((f) => `${f.name} (${f.type})`).join(", ")}`;
    }
    case "ai.write":
      return `Instructions: ${q(s(c, "instructions"))}`;
    case "action.email":
      return `To ${s(c, "to")} · ${q(s(c, "body"))}`;
    case "action.slack":
      return `${s(c, "channel")} · ${q(s(c, "message"))}`;
    case "action.sheetRow":
      return `${s(c, "sheet")}: ${Object.entries((c.values ?? {}) as Record<string, string>)
        .map(([k, v]) => `${k} = ${v}`)
        .join(", ")}`;
    default:
      return "";
  }
}

/** Host-only walkthrough of every level's solution. Unlocks once the room's session has ended. */
export function SolutionsScreen() {
  const params = useSearchParams();
  const code = normalizeCode(params.get("room") ?? "") || null;
  const { room } = useRoom(code);
  const [idx, setIdx] = useState(0);
  const level = LEVELS[idx];
  const solution = useMemo(() => autoLayout(level.reference), [level]);
  const order = useMemo(() => topoOrder(solution), [solution]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setIdx((i) => Math.min(LEVELS.length - 1, i + 1));
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!code || (room && room.phase !== "ended")) {
    return (
      <div className="grid min-h-screen place-items-center bg-paper p-8 text-center">
        <div className="max-w-sm">
          <div className="mx-auto mb-5 grid size-14 place-items-center rounded-full bg-crimson-soft text-crimson">
            <Lock size={24} />
          </div>
          <h1 className="display text-[28px]">Solutions unlock at the end</h1>
          <p className="mt-2 text-[15px] text-muted">End the session from the host page to walk everyone through the answers.</p>
        </div>
      </div>
    );
  }
  if (!room) return null;

  return (
    <div className="flex h-screen flex-col bg-paper">
      <header className="flex h-16 shrink-0 items-center gap-5 border-b border-line px-6">
        <Logo compact />
        <span className="rounded-full bg-sand px-3 py-1 text-[13px] font-medium text-ink-2">Solutions</span>
        <nav className="mx-auto flex gap-1.5" aria-label="Levels">
          {LEVELS.map((l, i) => (
            <button
              key={l.id}
              onClick={() => setIdx(i)}
              title={l.title}
              className={`grid size-9 place-items-center rounded-full text-[14px] font-semibold transition ${
                i === idx ? "bg-crimson text-paper ring-4 ring-crimson/15" : "bg-paper text-ink-2 ring-1 ring-line hover:ring-ink-2"
              }`}
            >
              {l.id}
            </button>
          ))}
        </nav>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0}>
            <ArrowLeft size={14} /> Prev
          </Button>
          <Button size="sm" onClick={() => setIdx(Math.min(LEVELS.length - 1, idx + 1))} disabled={idx === LEVELS.length - 1}>
            Next <ArrowRight size={14} />
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-[420px] shrink-0 overflow-y-auto border-r border-line bg-cream px-6 py-6">
          <div className="eyebrow">
            Level {level.id} · {level.skill}
          </div>
          <h1 className="display mt-1.5 text-[30px] leading-tight">{level.title}</h1>
          <p className="mt-3 text-[16px] leading-snug font-semibold text-ink">{level.task}</p>

          <div className="mt-4 flex gap-2.5 rounded-lg bg-paper px-4 py-3 ring-1 ring-line">
            <Sparkles size={16} className="mt-0.5 shrink-0 text-crimson" />
            <p className="text-[14px] leading-relaxed text-ink-2">{level.skillHow}</p>
          </div>

          <h2 className="mt-6 mb-2 text-[12px] font-semibold tracking-[0.06em] text-muted uppercase">How the solution works</h2>
          <ol className="space-y-2">
            {order.map((id, i) => {
              const n = solution.nodes.find((x) => x.id === id)!;
              const def = NODES[n.type];
              const Icon = NODE_ICON[n.type];
              const extra = details(n);
              return (
                <li key={id} className="flex gap-3 rounded-lg bg-paper px-3.5 py-3 ring-1 ring-line">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg" style={tileStyle(def.category)}>
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[11.5px] font-medium text-muted">
                      {i + 1} · {CATEGORY_WORD[def.category]}
                    </div>
                    <div className="text-[14.5px] font-semibold">{def.label}</div>
                    <div className="text-[13px] text-ink-2">{def.summary(n.config)}</div>
                    {extra && <div className="mt-1 font-mono text-[11.5px] leading-relaxed break-words text-muted">{extra}</div>}
                  </div>
                </li>
              );
            })}
          </ol>

          {level.traps.length > 0 && (
            <>
              <h2 className="mt-6 mb-2 text-[12px] font-semibold tracking-[0.06em] text-muted uppercase">Common mistakes the tests caught</h2>
              <ul className="space-y-1.5">
                {level.traps.map((t) => (
                  <li key={t.name} className="flex gap-2 rounded bg-warn-soft px-3 py-2 text-[13.5px] text-ink-2">
                    <TriangleAlert size={14} className="mt-0.5 shrink-0 text-warn" />
                    <span className="first-letter:uppercase">{t.name}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>

        <main className="min-w-0 flex-1">
          <Canvas key={level.id} workflow={solution} readOnly />
        </main>
      </div>
    </div>
  );
}
