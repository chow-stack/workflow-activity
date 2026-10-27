"use client";

import { ArrowRight, Check, ChevronDown, Hash, Inbox, Rows3, TriangleAlert, X } from "lucide-react";
import { useState } from "react";
import type { GradeResult, TestResult } from "@/engine/grade";
import type { Level, World } from "@/engine/types";
import { InputPreview, Table } from "./DataPreview";

interface Props {
  level: Level;
  grade: GradeResult;
  stale: boolean;
  earned: number | null;
  hasNext: boolean;
  onNext: () => void;
  onClose: () => void;
}

export function ResultsDrawer({ level, grade, stale, earned, hasNext, onNext, onClose }: Props) {
  const firstFail = grade.tests.find((t) => !t.passed)?.id ?? grade.tests[0]?.id;
  const [sel, setSel] = useState(firstFail);
  const test = grade.tests.find((t) => t.id === sel) ?? grade.tests[0];
  const passedCount = grade.tests.filter((t) => t.passed).length;

  return (
    <section className="animate-pop z-20 flex h-[42%] min-h-[280px] shrink-0 flex-col border-t border-line bg-cream">
      {grade.passed ? (
        <div className="flex items-center gap-4 bg-pass px-6 py-3 text-white">
          <span className="grid size-8 place-items-center rounded-full bg-white/20">
            <Check size={18} strokeWidth={3} />
          </span>
          <div className="flex-1">
            <div className="font-display text-xl">Level cleared!</div>
            <div className="text-[13px] opacity-90">
              All {grade.tests.length} tests passed{earned !== null ? ` · +${earned} points` : ""}
            </div>
          </div>
          {hasNext && (
            <button onClick={onNext} className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-[14px] font-medium text-pass hover:bg-white/90">
              Next level <ArrowRight size={16} />
            </button>
          )}
          <button onClick={onClose} className="rounded p-1 hover:bg-white/15" aria-label="Close results">
            <ChevronDown size={20} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 border-b border-line px-6 py-3">
          <div className="font-display text-xl">
            {passedCount} / {grade.tests.length} tests passed
          </div>
          {stale && <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[11.5px] text-warn">You changed the workflow since this run</span>}
          <button onClick={onClose} className="ml-auto rounded p-1 text-ink-muted hover:bg-line/60" aria-label="Close results">
            <ChevronDown size={20} />
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <div className="w-[300px] shrink-0 overflow-y-auto border-r border-line p-3">
          {grade.tests.map((t) => (
            <button
              key={t.id}
              onClick={() => setSel(t.id)}
              className={`mb-1 flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] ${
                t.id === test?.id ? "bg-surface ring-1 ring-line" : "hover:bg-surface/60"
              }`}
            >
              <span className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full text-white ${t.passed ? "bg-pass" : "bg-fail"}`}>
                {t.passed ? <Check size={11} strokeWidth={3} /> : <X size={11} strokeWidth={3} />}
              </span>
              <span>
                {t.label}
                {t.hidden && <span className="ml-1.5 text-[11px] text-ink-muted">hidden</span>}
              </span>
            </button>
          ))}
        </div>
        {test && <TestDetail level={level} test={test} />}
      </div>
    </section>
  );
}

function TestDetail({ level, test }: { level: Level; test: TestResult }) {
  const [tab, setTab] = useState<"result" | "input">("result");
  const input = level.tests.find((t) => t.id === test.id)!.input;
  return (
    <div className="min-w-0 flex-1 overflow-y-auto px-6 py-4">
      <div className="mb-4 flex gap-1 text-[13px]">
        {(["result", "input"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`rounded-full px-3 py-1 ${tab === k ? "bg-ink text-cream" : "text-ink-muted hover:bg-line/60"}`}
          >
            {k === "result" ? "What happened" : "Test input"}
          </button>
        ))}
      </div>

      {tab === "input" ? (
        <InputPreview input={input} />
      ) : (
        <>
          {!test.passed && (
            <ul className="mb-5 space-y-1.5">
              {test.messages.map((m, i) => (
                <li key={i} className="flex gap-2 text-[13.5px] leading-snug">
                  <X size={15} className="mt-0.5 shrink-0 text-fail" />
                  <span>{m}</span>
                </li>
              ))}
            </ul>
          )}
          {test.trace.warnings.length > 0 && (
            <ul className="mb-5 space-y-1.5">
              {test.trace.warnings.map((w) => (
                <li key={w} className="flex gap-2 text-[13px] text-warn">
                  <TriangleAlert size={15} className="mt-0.5 shrink-0" />
                  <span className="font-mono">{w}</span>
                </li>
              ))}
            </ul>
          )}
          <WorldView world={test.world} />
        </>
      )}
    </div>
  );
}

function WorldView({ world }: { world: World }) {
  const empty = world.slack.length + world.emails.length + world.rows.length === 0;
  if (empty) return <div className="text-[13px] text-ink-muted italic">The workflow didn&apos;t send or save anything.</div>;
  const sheets = [...new Set(world.rows.map((r) => r.sheet))];
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {world.slack.length > 0 && (
        <Panel icon={<Hash size={14} />} title={`Slack · ${world.slack.length}`}>
          <div className="space-y-2">
            {world.slack.slice(0, 30).map((m, i) => (
              <div key={i} className="rounded-lg bg-surface px-3 py-2 ring-1 ring-line">
                <div className="flex gap-2 text-[11.5px] text-ink-muted">
                  <span className="font-medium text-ink">{m.channel}</span>
                  {m.at && <span>{m.at}</span>}
                </div>
                <div className="mt-0.5 text-[13px] whitespace-pre-wrap">{m.text || <em className="text-ink-muted">(empty)</em>}</div>
              </div>
            ))}
            {world.slack.length > 30 && <div className="text-[12px] text-ink-muted">…and {world.slack.length - 30} more</div>}
          </div>
        </Panel>
      )}
      {world.emails.length > 0 && (
        <Panel icon={<Inbox size={14} />} title={`Emails sent · ${world.emails.length}`}>
          <div className="space-y-2">
            {world.emails.slice(0, 20).map((m, i) => (
              <div key={i} className="rounded-lg bg-surface px-3 py-2 ring-1 ring-line">
                <div className="text-[11.5px] text-ink-muted">
                  To <span className="font-mono text-ink">{m.to || "(nobody)"}</span>
                </div>
                {m.subject && <div className="mt-0.5 text-[13px] font-medium">{m.subject}</div>}
                <div className="mt-0.5 text-[13px] whitespace-pre-wrap text-ink/85">{m.body}</div>
              </div>
            ))}
          </div>
        </Panel>
      )}
      {sheets.map((s) => (
        <Panel key={s} icon={<Rows3 size={14} />} title={`Rows added to ${s}`}>
          <Table rows={world.rows.filter((r) => r.sheet === s).map((r) => r.row)} />
        </Panel>
      ))}
    </div>
  );
}

function Panel({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-[12px] font-medium tracking-wide text-ink-muted uppercase">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}
