"use client";

import { ArrowRight } from "lucide-react";
import { NODES, isTrigger } from "@/engine/nodes";
import type { Issue } from "@/engine/validate";
import type { Workflow } from "@/engine/types";

interface Props {
  workflow: Workflow;
  issues: Issue[];
  cleared: boolean;
  /** The latest run failed and the workflow hasn't changed since. */
  failed: boolean;
  onFocus: (nodeId: string) => void;
}

const STEPS = ["Add a trigger", "Add & set up steps", "Run tests"];

/** Always tells the captain the single next thing to do. */
export function GuideBar({ workflow, issues, cleared, failed, onFocus }: Props) {
  const hasTrigger = workflow.nodes.some((n) => isTrigger(n.type));
  const nodeIssue = issues.find((i) => i.nodeId);
  let stage = 0;
  let text: React.ReactNode;

  if (cleared) {
    stage = 3;
    text = "Level cleared. Head to the next one from the results panel.";
  } else if (!hasTrigger) {
    text = "Start with a trigger: what event kicks this workflow off?";
  } else if (workflow.nodes.length === 1) {
    stage = 1;
    text = "Add the next step: use “Add step”, or drag from the dot on the right of your trigger.";
  } else if (nodeIssue) {
    stage = 1;
    const node = workflow.nodes.find((n) => n.id === nodeIssue.nodeId)!;
    text = (
      <button onClick={() => onFocus(node.id)} className="inline-flex items-center gap-1 text-left hover:underline">
        Finish setting up <b className="font-semibold">{NODES[node.type].label}</b>: {nodeIssue.message.replace(/^[^:]+: /, "")}
        <ArrowRight size={14} />
      </button>
    );
  } else if (issues.length) {
    stage = 1;
    text = issues[0].message;
  } else if (failed) {
    stage = 2;
    text = "Some tests failed. Click a red test below to see why, fix the step, then run again.";
  } else {
    stage = 2;
    text = "Looks complete. Press Run tests to check it against the examples.";
  }

  return (
    <div className="pointer-events-auto flex max-w-[640px] min-w-0 items-center gap-4 rounded-[20px] bg-paper py-2 pr-5 pl-2 text-[13.5px] shadow-[0_2px_10px_rgb(46_31_31/0.06)] ring-1 ring-line">
      <ol className="flex shrink-0 items-center gap-1">
        {STEPS.map((s, i) => (
          <li
            key={s}
            title={s}
            className={`grid size-6 place-items-center rounded-full text-[11.5px] font-semibold ${
              i < stage ? "bg-pass text-paper" : i === stage ? "bg-crimson text-paper" : "bg-sand text-muted"
            }`}
          >
            {i < stage ? "✓" : i + 1}
          </li>
        ))}
      </ol>
      <span className="min-w-0 text-ink-2">{text}</span>
    </div>
  );
}
