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
          stroke: lit ? "var(--color-crimson)" : selected ? "var(--color-ink)" : "var(--color-edge)",
          strokeWidth: lit ? 2.5 : 2,
        }}
      />
      {(data?.count ?? 0) > 0 && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan animate-pop pointer-events-none absolute rounded-full bg-crimson px-2 py-0.5 text-[11px] font-medium text-paper"
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
