"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Check, CircleAlert } from "lucide-react";
import { memo } from "react";
import { NODES } from "@/engine/nodes";
import type { WfNode } from "@/engine/types";
import type { NodeRunState } from "@/lib/store";
import { CATEGORY_WORD, NODE_ICON, tileStyle } from "./icons";

export type CardData = {
  node: WfNode;
  step?: number; // position in the flow, shown as "1 · Trigger"
  issue?: string; // what still needs setting up
  strict?: boolean; // after a Run attempt, issues turn red
  run?: NodeRunState;
  readOnly?: boolean;
};
export type CardNode = Node<CardData, "wf">;

function NodeCardImpl({ data, selected }: NodeProps<CardNode>) {
  const { node, step, issue, strict, run, readOnly } = data;
  const def = NODES[node.type];
  const Icon = NODE_ICON[node.type];
  const trigger = def.category === "trigger";
  const outputs = def.outputs(node.config);
  const multi = outputs.length > 1 || outputs[0]?.id !== "out";

  const ring =
    run === "running"
      ? "ring-2 ring-crimson shadow-[0_0_0_6px_rgb(152_27_37/0.12)]"
      : selected
        ? "ring-2 ring-ink"
        : issue && strict
          ? "ring-1 ring-fail"
          : "ring-1 ring-line hover:ring-line-strong";

  return (
    <div
      className={`relative w-[264px] rounded-lg bg-paper transition ${ring} ${run === "skipped" ? "opacity-50" : ""} ${
        run === "running" && def.category === "ai" ? "ai-thinking" : ""
      }`}
    >
      {!trigger && <Handle type="target" position={Position.Left} id="in" isConnectable={!readOnly} style={{ top: 34 }} />}

      <div className="flex items-start gap-3 px-3.5 pt-3 pb-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg" style={tileStyle(def.category)}>
          <Icon size={18} strokeWidth={2} />
        </span>
        <div className="min-w-0 pt-0.5">
          <div className="text-[11px] font-medium text-muted">
            {step ? `${step} · ` : ""}
            {CATEGORY_WORD[def.category]}
          </div>
          <div className="truncate text-[14px] leading-tight font-semibold text-ink">{def.label}</div>
        </div>
      </div>

      <div
        className={`border-t border-line px-3.5 py-2 text-[12px] leading-snug ${
          issue ? (strict ? "text-fail" : "text-warn") : "text-muted"
        }`}
      >
        {issue ? (
          <span className="flex items-center gap-1.5">
            <CircleAlert size={13} className="shrink-0" />
            <span className="truncate">{issue}</span>
          </span>
        ) : (
          <span className="block truncate">{def.summary(node.config)}</span>
        )}
      </div>

      {multi ? (
        <div className="border-t border-line py-1">
          {outputs.map((h) => (
            <div key={h.id} className="relative flex h-7 items-center justify-end pr-4 text-[12px] font-medium text-ink-2">
              <span className="truncate">{h.label ?? h.id}</span>
              <Handle type="source" position={Position.Right} id={h.id} isConnectable={!readOnly} />
            </div>
          ))}
        </div>
      ) : (
        <Handle type="source" position={Position.Right} id="out" isConnectable={!readOnly} style={{ top: 34 }} />
      )}

      {run === "ran" && (
        <div className="animate-pop absolute -top-2 -right-2 grid size-5 place-items-center rounded-full bg-pass text-paper">
          <Check size={13} strokeWidth={3} />
        </div>
      )}
    </div>
  );
}

export const NodeCard = memo(NodeCardImpl);
