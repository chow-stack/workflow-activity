"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Check, CircleAlert } from "lucide-react";
import { memo } from "react";
import { NODES } from "@/engine/nodes";
import type { WfNode } from "@/engine/types";
import type { NodeRunState } from "@/lib/store";
import { CATEGORY_COLOR, NODE_ICON } from "./icons";

export type CardData = { node: WfNode; issue?: string; run?: NodeRunState; readOnly?: boolean };
export type CardNode = Node<CardData, "wf">;

function NodeCardImpl({ data, selected }: NodeProps<CardNode>) {
  const { node, issue, run, readOnly } = data;
  const def = NODES[node.type];
  const Icon = NODE_ICON[node.type];
  const color = CATEGORY_COLOR[def.category];
  const trigger = def.category === "trigger";
  const outputs = def.outputs(node.config);
  const multi = outputs.length > 1 || outputs[0]?.id !== "out";

  const ring = run === "running"
    ? "0 0 0 2px var(--color-ember), 0 0 24px rgb(240 122 61 / 0.45)"
    : selected
      ? "0 0 0 2px var(--color-crimson), 0 0 0 5px rgb(152 27 37 / 0.25)"
      : "0 0 0 1px var(--color-node-border)";

  return (
    <div
      className={`relative w-[232px] bg-node text-node-text transition-[box-shadow,opacity] duration-200 ${
        trigger ? "rounded-l-[30px] rounded-r-node" : "rounded-node"
      } ${run === "skipped" ? "opacity-45" : ""} ${run === "running" && def.category === "ai" ? "ai-thinking" : ""}`}
      style={{ boxShadow: ring }}
    >
      {!trigger && (
        <Handle type="target" position={Position.Left} id="in" isConnectable={!readOnly} style={{ top: 30 }} />
      )}

      <div className="flex items-center gap-3 px-3 py-3">
        <div
          className={`grid size-9 shrink-0 place-items-center ${trigger ? "rounded-full" : "rounded-lg"}`}
          style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color }}
        >
          <Icon size={18} strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-medium leading-tight">{def.label}</div>
          <div className="mt-0.5 truncate text-[11.5px] text-node-muted">{def.summary(node.config)}</div>
        </div>
      </div>

      {multi ? (
        <div className="border-t border-node-border/70 py-1">
          {outputs.map((h) => (
            <div key={h.id} className="relative flex h-6 items-center justify-end pr-4 text-[11px] text-node-muted">
              <span className="truncate font-mono">{h.label ?? h.id}</span>
              <Handle type="source" position={Position.Right} id={h.id} isConnectable={!readOnly} />
            </div>
          ))}
        </div>
      ) : (
        <Handle type="source" position={Position.Right} id="out" isConnectable={!readOnly} style={{ top: 30 }} />
      )}

      <div className="absolute top-0 left-0 h-full w-[3px] rounded-l-full" style={{ background: color, opacity: trigger ? 0 : 1 }} />

      {issue && !readOnly && (
        <div title={issue} className="absolute -top-2 -right-2 grid size-5 place-items-center rounded-full bg-fail text-white">
          <CircleAlert size={13} />
        </div>
      )}
      {run === "ran" && (
        <div className="animate-pop absolute -top-2 -right-2 grid size-5 place-items-center rounded-full bg-pass text-white">
          <Check size={13} strokeWidth={3} />
        </div>
      )}
    </div>
  );
}

export const NodeCard = memo(NodeCardImpl);
