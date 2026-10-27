"use client";

import { BaseEdge, EdgeLabelRenderer, getBezierPath, type Edge, type EdgeProps } from "@xyflow/react";
import { memo } from "react";

export type FlowEdgeData = { count?: number; flowing?: boolean };
export type FlowEdgeT = Edge<FlowEdgeData, "flow">;

function FlowEdgeImpl({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected }: EdgeProps<FlowEdgeT>) {
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const lit = data?.flowing || (data?.count ?? 0) > 0;
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        className={data?.flowing ? "edge-flowing" : ""}
        style={{
          stroke: lit ? "var(--color-ember)" : selected ? "#c9a3a6" : "var(--color-edge)",
          strokeWidth: lit ? 2.5 : 2,
          filter: data?.flowing ? "drop-shadow(0 0 4px rgb(240 122 61 / 0.7))" : undefined,
        }}
      />
      {(data?.count ?? 0) > 0 && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan animate-pop pointer-events-none absolute rounded-full bg-[#3a1f1c] px-2 py-0.5 font-mono text-[10.5px] text-[#ffd2b8] ring-1 ring-ember/50"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {data!.count} {data!.count === 1 ? "item" : "items"}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const FlowEdge = memo(FlowEdgeImpl);

