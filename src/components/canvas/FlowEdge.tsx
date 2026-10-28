"use client";

import { BaseEdge, EdgeLabelRenderer, getBezierPath, type Edge, type EdgeProps } from "@xyflow/react";
import { X } from "lucide-react";
import { memo } from "react";

export type FlowEdgeData = {
  count?: number;
  flowing?: boolean;
  /** Hovered or selected: show the delete button. */
  active?: boolean;
  onDelete?: (id: string) => void;
  onHover?: (id: string | null) => void;
};
export type FlowEdgeT = Edge<FlowEdgeData, "flow">;

function FlowEdgeImpl({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected }: EdgeProps<FlowEdgeT>) {
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const lit = data?.flowing || (data?.count ?? 0) > 0;
  const active = Boolean(data?.active && data.onDelete);
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        interactionWidth={22}
        className={data?.flowing ? "edge-flowing" : ""}
        style={{
          stroke: active || selected ? "var(--color-ink)" : lit ? "var(--color-crimson)" : "var(--color-edge)",
          strokeWidth: lit || active ? 2.5 : 2,
        }}
      />
      <EdgeLabelRenderer>
        {active ? (
          // Sits where the "3 items" badge goes; hovering swaps the badge for the delete button.
          <button
            type="button"
            title="Remove this connection"
            aria-label="Remove this connection"
            onClick={(e) => {
              e.stopPropagation();
              data!.onDelete!(id);
            }}
            onMouseEnter={() => data?.onHover?.(id)}
            onMouseLeave={() => data?.onHover?.(null)}
            className="nodrag nopan animate-pop absolute grid size-6 place-items-center rounded-full bg-paper text-ink shadow-[0_2px_8px_rgb(46_31_31/0.18)] ring-1 ring-ink transition hover:bg-fail hover:text-paper hover:ring-fail"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, pointerEvents: "all" }}
          >
            <X size={13} strokeWidth={2.75} />
          </button>
        ) : (
          (data?.count ?? 0) > 0 && (
            <div
              className="nodrag nopan animate-pop pointer-events-none absolute rounded-full bg-crimson px-2 py-0.5 text-[11px] font-medium text-paper"
              style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            >
              {data!.count} {data!.count === 1 ? "item" : "items"}
            </div>
          )
        )}
      </EdgeLabelRenderer>
    </>
  );
}

export const FlowEdge = memo(FlowEdgeImpl);
