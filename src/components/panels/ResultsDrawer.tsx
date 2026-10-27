"use client";

import { ArrowRight, Check, ChevronDown, Hash, Inbox, Rows3, TriangleAlert, X } from "lucide-react";
import { useState } from "react";
import type { GradeResult, TestResult } from "@/engine/grade";
import type { Level, World } from "@/engine/types";
import { Button } from "../ui";
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
    <section className="animate-rise flex h-[44%] min-h-[300px] shrink-0 flex-col border-t border-line bg-paper">
      {grade.passed ? (
        <div className="flex items-center gap-4 bg-pass px-6 py-3.5 text-paper">
          <span className="grid size-9 place-items-center rounded-full bg-paper/20">
            <Check size={19} strokeWidth={3} />
          </span>
          <div className="flex-1">
            <div className="display text-[20px] leading-tight">Level cleared!</div>
            <div className="text-[13px] opacity-90">
              All {grade.tests.length} tests passed{earned !== null ? ` · +${earned} points` : ""}
            </div>
          </div>
          {hasNext && (
            <Button onClick={onNext} className="bg-paper text-pass hover:bg-paper/90">
              Next level <ArrowRight size={16} />
            </Button>
          )}
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-paper/15" aria-label="Close results">
            <ChevronDown size={20} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-4 border-b border-line px-6 py-3">
          <div>
            <div className="display text-[18px] leading-tight">
              {passedCount} of {grade.tests.length} tests passed
            </div>
            <div className="text-[12.5px] text-muted">Pick a red test to see what went wrong.</div>
          </div>
          <div className="flex gap-1">
            {grade.tests.map((t) => (
              <span key={t.id} className={`h-2 w-6 rounded-full ${t.passed ? "bg-pass" : "bg-fail"}`} />
            ))}
          </div>
          {stale && <span className="rounded bg-warn-soft px-2 py-1 text-[12px] text-warn">You&apos;ve changed the workflow since this run</span>}
          <button onClick={onClose} className="ml-auto rounded-full p-1.5 text-muted hover:bg-sand" aria-label="Close results">
            <ChevronDown size={20} />
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <div className="w-[280px] shrink-0 overflow-y-auto border-r border-line bg-cream p-2.5">
          {grade.tests.map((t, i) => (
            <button
              key={t.id}
              onClick={() => setSel(t.id)}
              className={`mb-1 flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13.5px] ${
                t.id === test?.id ? "bg-paper ring-1 ring-line-strong" : "hover:bg-paper/70"
              }`}
            >
              <span className={`mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full text-paper ${t.passed ? "bg-pass" : "bg-fail"}`}>
                {t.passed ? <Check size={11} strokeWidth={3.5} /> : <X size={11} strokeWidth={3.5} />}
              </span>
              <span className="min-w-0">
                <span className="block text-[11px] text-muted">
                  Test {i + 1}
                  {t.hidden ? " · hidden" : ""}
                </span>
                <span className="block leading-snug">{t.label}</span>
              </span>
            </button>
          ))}
        </div>
        {test && <TestDetail key={test.id} level={level} test={test} />}
      </div>
    </section>
  );
}

function TestDetail({ level, test }: { level: Level; test: TestResult }) {
  const [tab, setTab] = useState<"result" | "input">("result");
  const input = level.tests.find((t) => t.id === test.id)!.input;
  return (
    <div className="min-w-0 flex-1 overflow-y-auto px-6 py-4">
      <div className="mb-4 inline-flex rounded-full bg-sand p-0.5 text-[13px]">
        {(["result", "input"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`rounded-full px-3.5 py-1 font-medium ${tab === k ? "bg-paper text-ink shadow-sm" : "text-muted hover:text-ink"}`}
          >
            {k === "result" ? "Result" : "Data we sent in"}
          </button>
        ))}
      </div>

      {tab === "input" ? (
        <div className="max-w-[560px]">
          <InputPreview input={input} />
        </div>
      ) : (
        <>
          {test.passed ? (
            <div className="mb-5 flex items-center gap-2 rounded-lg bg-pass-soft px-4 py-3 text-[14px] font-medium text-pass">
              <Check size={16} strokeWidth={3} /> This test passed.
            </div>
          ) : (
            <div className="mb-5 rounded-lg bg-fail-soft px-4 py-3.5">
              <div className="mb-2 text-[12px] font-semibold tracking-[0.06em] text-fail uppercase">What went wrong</div>
              <ul className="space-y-1.5">
                {test.messages.map((m, i) => (
                  <li key={i} className="flex gap-2 text-[14px] leading-snug text-ink">
                    <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-fail" />
                    <span>{m}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {test.trace.warnings.length > 0 && (
            <ul className="mb-5 space-y-1.5">
              {test.trace.warnings.map((w) => (
                <li key={w} className="flex gap-2 rounded bg-warn-soft px-3 py-2 text-[13px] text-warn">
                  <TriangleAlert size={15} className="mt-0.5 shrink-0" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mb-2 text-[12px] font-semibold tracking-[0.06em] text-muted uppercase">What your workflow did</div>
          <WorldView world={test.world} />
        </>
      )}
    </div>
  );
}

function WorldView({ world }: { world: World }) {
  const empty = world.slack.length + world.emails.length + world.rows.length === 0;
  if (empty) return <div className="rounded-lg border border-dashed border-line-strong px-4 py-3 text-[13.5px] text-muted">Nothing. No messages, emails or rows.</div>;
  const sheets = [...new Set(world.rows.map((r) => r.sheet))];
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {world.slack.length > 0 && (
        <Panel icon={<Hash size={14} />} title={`Slack messages · ${world.slack.length}`}>
          {world.slack.slice(0, 30).map((m, i) => (
            <div key={i} className="rounded-lg bg-paper px-3 py-2 ring-1 ring-line">
              <div className="flex gap-2 text-[12px] text-muted">
                <span className="font-semibold text-ink">{m.channel}</span>
                {m.at && <span>{m.at}</span>}
              </div>
              <div className="mt-0.5 text-[13.5px] whitespace-pre-wrap">{m.text || <em className="text-muted">(empty)</em>}</div>
            </div>
          ))}
          {world.slack.length > 30 && <div className="text-[12.5px] text-muted">…and {world.slack.length - 30} more</div>}
        </Panel>
      )}
      {world.emails.length > 0 && (
        <Panel icon={<Inbox size={14} />} title={`Emails sent · ${world.emails.length}`}>
          {world.emails.slice(0, 20).map((m, i) => (
            <div key={i} className="rounded-lg bg-paper px-3 py-2 ring-1 ring-line">
              <div className="text-[12px] text-muted">
                To <span className="font-medium text-ink">{m.to || "(nobody)"}</span>
              </div>
              {m.subject && <div className="mt-0.5 text-[13.5px] font-semibold">{m.subject}</div>}
              <div className="mt-0.5 text-[13.5px] whitespace-pre-wrap text-ink-2">{m.body}</div>
            </div>
          ))}
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
      <div className="mb-2 flex items-center gap-1.5 text-[12.5px] font-medium text-ink-2">
        {icon}
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
