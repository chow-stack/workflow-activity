"use client";

import { ArrowRight, Check, ChevronDown, Hash, Lightbulb, Mail, Rows3, TriangleAlert, X } from "lucide-react";
import { useState } from "react";
import type { CheckLine, GradeResult, TestResult } from "@/engine/grade";
import type { Level } from "@/engine/types";
import { Button } from "../ui";
import { InputPreview } from "./DataPreview";

interface Props {
  level: Level;
  grade: GradeResult;
  stale: boolean;
  earned: number | null;
  hasNext: boolean;
  /** Replaces the "Next level" button, e.g. "wait for the host" after the demo. */
  doneNote?: string;
  onNext: () => void;
  onClose: () => void;
}

export function ResultsDrawer({ level, grade, stale, earned, hasNext, doneNote, onNext, onClose }: Props) {
  const firstFail = grade.tests.find((t) => !t.passed)?.id ?? grade.tests[0]?.id;
  const [sel, setSel] = useState(firstFail);
  const test = grade.tests.find((t) => t.id === sel) ?? grade.tests[0];
  const passedCount = grade.tests.filter((t) => t.passed).length;

  return (
    <section className="animate-rise flex h-[46%] min-h-[320px] shrink-0 flex-col border-t border-line bg-paper">
      {grade.passed ? (
        <div className="flex items-center gap-4 bg-pass px-6 py-3.5 text-paper">
          <span className="grid size-9 place-items-center rounded-full bg-paper/20">
            <Check size={19} strokeWidth={3} />
          </span>
          <div className="flex-1">
            <div className="display text-[20px] leading-tight">{level.id === 0 ? "Demo complete!" : "Level cleared!"}</div>
            <div className="text-[13.5px] opacity-90">
              {doneNote ?? `All ${grade.tests.length} tests passed${earned !== null ? ` · +${earned} points` : ""}`}
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
          <span className="grid size-9 place-items-center rounded-full bg-fail-soft text-fail">
            <X size={18} strokeWidth={3} />
          </span>
          <div>
            <div className="display text-[18px] leading-tight">
              {passedCount} of {grade.tests.length} tests passed
            </div>
            <div className="text-[12.5px] text-muted">Pick a red test to see exactly what&apos;s different.</div>
          </div>
          {stale && <span className="rounded bg-warn-soft px-2 py-1 text-[12px] text-warn">You&apos;ve changed the workflow since this run</span>}
          <button onClick={onClose} className="ml-auto rounded-full p-1.5 text-muted hover:bg-sand" aria-label="Close results">
            <ChevronDown size={20} />
          </button>
        </div>
      )}

      <div className="flex gap-1.5 overflow-x-auto border-b border-line bg-cream px-4 py-2.5" role="tablist">
        {grade.tests.map((t, i) => {
          const on = t.id === test?.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={on}
              onClick={() => setSel(t.id)}
              className={`flex shrink-0 items-center gap-2 rounded-full py-1.5 pr-3.5 pl-1.5 text-[13px] transition ${
                on ? "bg-paper font-semibold text-ink ring-[1.5px] ring-ink" : "text-ink-2 ring-1 ring-line hover:bg-paper"
              }`}
            >
              <span className={`grid size-5 place-items-center rounded-full text-paper ${t.passed ? "bg-pass" : "bg-fail"}`}>
                {t.passed ? <Check size={11} strokeWidth={3.5} /> : <X size={11} strokeWidth={3.5} />}
              </span>
              Test {i + 1}
              <span className={on ? "font-normal text-muted" : "text-muted"}>· {t.label}</span>
            </button>
          );
        })}
      </div>

      {test && <TestDetail key={test.id} level={level} test={test} />}
    </section>
  );
}

const KIND_ICON = { slack: Hash, email: Mail, row: Rows3 } as const;

function Line({ line, side }: { line: CheckLine; side: "expected" | "actual" }) {
  const Icon = KIND_ICON[line.kind];
  const bad = side === "expected" ? "Didn't happen" : "Shouldn't happen";
  return (
    <li className={`flex gap-2.5 rounded-lg px-3 py-2.5 text-[13.5px] leading-snug ${line.ok ? "bg-pass-soft" : "bg-fail-soft"}`}>
      <span className={`mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full text-paper ${line.ok ? "bg-pass" : "bg-fail"}`}>
        {line.ok ? <Check size={11} strokeWidth={3.5} /> : <X size={11} strokeWidth={3.5} />}
      </span>
      <span className="min-w-0">
        <span className="flex items-start gap-1.5 text-ink">
          <Icon size={13} className="mt-[3px] shrink-0 text-muted" />
          <span className="break-words">{line.text}</span>
        </span>
        {!line.ok && <span className="mt-0.5 block text-[12px] font-medium text-fail">{bad}</span>}
      </span>
    </li>
  );
}

function TestDetail({ level, test }: { level: Level; test: TestResult }) {
  const [showInput, setShowInput] = useState(false);
  const input = level.tests.find((t) => t.id === test.id)!.input;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
      {test.problem && (
        <div className="mb-4 flex gap-2.5 rounded-lg bg-fail-soft px-4 py-3 text-[14px] text-ink">
          <TriangleAlert size={17} className="mt-0.5 shrink-0 text-fail" />
          {test.problem}
        </div>
      )}

      {!test.problem && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-[12px] font-semibold tracking-[0.06em] text-muted uppercase">Should happen</h3>
            {test.expected.length ? (
              <ul className="space-y-1.5">
                {test.expected.map((l, i) => (
                  <Line key={i} line={l} side="expected" />
                ))}
              </ul>
            ) : (
              <p className="rounded-lg bg-cream px-3 py-2.5 text-[13.5px] text-ink-2">Nothing. This test checks that your workflow stays quiet.</p>
            )}
          </div>
          <div>
            <h3 className="mb-2 text-[12px] font-semibold tracking-[0.06em] text-muted uppercase">Your workflow did</h3>
            {test.actual.length ? (
              <ul className="space-y-1.5">
                {test.actual.slice(0, 12).map((l, i) => (
                  <Line key={i} line={l} side="actual" />
                ))}
                {test.actual.length > 12 && <li className="px-3 text-[12.5px] text-muted">…and {test.actual.length - 12} more</li>}
              </ul>
            ) : (
              <p className={`rounded-lg px-3 py-2.5 text-[13.5px] ${test.expected.length ? "bg-fail-soft text-ink" : "bg-pass-soft text-pass"}`}>
                Nothing{test.expected.length ? "." : ", which is right."}
              </p>
            )}
          </div>
        </div>
      )}

      {test.hint && (
        <div className="mt-4 flex gap-2.5 rounded-lg bg-warn-soft px-4 py-3 text-[13.5px] leading-snug text-ink-2">
          <Lightbulb size={16} className="mt-0.5 shrink-0 text-warn" />
          {test.hint}
        </div>
      )}

      {test.trace.warnings.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {test.trace.warnings.map((w) => (
            <li key={w} className="flex gap-2 text-[13px] text-warn">
              <TriangleAlert size={14} className="mt-0.5 shrink-0" />
              {w}
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={() => setShowInput(!showInput)}
        className="mt-4 flex items-center gap-1 text-[13px] font-medium text-ink-2 underline-offset-2 hover:underline"
      >
        <ChevronDown size={14} className={`transition ${showInput ? "rotate-180" : ""}`} />
        {showInput ? "Hide" : "Show"} the data this test sent in
      </button>
      {showInput && (
        <div className="mt-3 max-w-[560px]">
          <InputPreview input={input} />
        </div>
      )}
    </div>
  );
}
