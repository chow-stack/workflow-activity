"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type EdgeChange,
  type FinalConnectionState,
  type NodeChange,
} from "@xyflow/react";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { topoOrder } from "@/engine/graph";
import { NODES, isTrigger } from "@/engine/nodes";
import type { NodeType, Workflow } from "@/engine/types";
import type { Anim } from "@/lib/store";
import { AddNodeMenu } from "./AddNodeMenu";
import { FlowEdge, type FlowEdgeT } from "./FlowEdge";
import { NodeCard, type CardNode } from "./NodeCard";

const nodeTypes = { wf: NodeCard };
const edgeTypes = { flow: FlowEdge };

export interface CanvasProps {
  workflow: Workflow;
  palette?: NodeType[];
  readOnly?: boolean;
  selectedId?: string | null;
  issues?: Record<string, string>;
  /** Show issues as errors (red) instead of to-dos (amber). True after a Run attempt. */
  strict?: boolean;
  anim?: Anim;
  onAdd?: (type: NodeType, pos: { x: number; y: number }, from?: { source: string; handle: string }) => void;
  onMove?: (id: string, pos: { x: number; y: number }) => void;
  onRemoveNodes?: (ids: string[]) => void;
  onRemoveEdges?: (ids: string[]) => void;
  onConnect?: (source: string, handle: string, target: string) => string | null;
  onSelect?: (id: string | null) => void;
  overlay?: ReactNode;
  /** Changing this re-fits the view (e.g. when the results drawer resizes the canvas). */
  fitKey?: string | number | boolean;
}

type Pending = { pos: { x: number; y: number }; from?: { source: string; handle: string } };

function CanvasInner(p: CanvasProps) {
  const rf = useReactFlow();
  const wrapper = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<Pending | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const steps = useMemo(() => {
    const order = topoOrder(p.workflow);
    return Object.fromEntries(order.map((id, i) => [id, i + 1]));
  }, [p.workflow]);

  const nodes = useMemo<CardNode[]>(
    () =>
      p.workflow.nodes.map((n) => ({
        id: n.id,
        type: "wf",
        position: n.position,
        selected: n.id === p.selectedId,
        draggable: !p.readOnly,
        data: {
          node: n,
          step: steps[n.id],
          issue: p.issues?.[n.id],
          strict: p.strict,
          run: p.anim && Object.keys(p.anim.nodes).length ? p.anim.nodes[n.id] : undefined,
          readOnly: p.readOnly,
        },
      })),
    [p.workflow.nodes, p.selectedId, p.issues, p.strict, p.anim, p.readOnly, steps],
  );

  const edges = useMemo<FlowEdgeT[]>(
    () =>
      p.workflow.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle ?? "out",
        targetHandle: "in",
        type: "flow",
        data: { count: p.anim?.edges[e.id], flowing: p.anim?.flowing[e.id] },
      })),
    [p.workflow.edges, p.anim],
  );

  const firstFit = useRef(true);
  useEffect(() => {
    if (firstFit.current) {
      firstFit.current = false;
      return;
    }
    const id = window.setTimeout(() => rf.fitView({ padding: 0.3, maxZoom: 1, duration: 250 }), 60);
    return () => window.clearTimeout(id);
  }, [p.fitKey, rf]);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  };

  const onNodesChange = useCallback(
    (changes: NodeChange<CardNode>[]) => {
      const removed: string[] = [];
      for (const c of changes) {
        if (c.type === "position" && c.position) p.onMove?.(c.id, c.position);
        if (c.type === "remove") removed.push(c.id);
        if (c.type === "select" && c.selected) p.onSelect?.(c.id);
      }
      if (removed.length) p.onRemoveNodes?.(removed);
    },
    [p],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<FlowEdgeT>[]) => {
      const removed = changes.filter((c) => c.type === "remove").map((c) => c.id);
      if (removed.length) p.onRemoveEdges?.(removed);
    },
    [p],
  );

  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target) return;
      const err = p.onConnect?.(c.source, c.sourceHandle ?? "out", c.target);
      if (err) flash(err);
    },
    [p],
  );

  // Dropping a connection on empty canvas opens the menu, n8n-style.
  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, state: FinalConnectionState) => {
      if (p.readOnly || state.isValid || !state.fromNode || state.fromHandle?.type !== "source") return;
      const pt = "changedTouches" in event ? event.changedTouches[0] : event;
      const pos = rf.screenToFlowPosition({ x: pt.clientX, y: pt.clientY });
      setMenu({ pos: { x: pos.x, y: pos.y - 30 }, from: { source: state.fromNode.id, handle: state.fromHandle.id ?? "out" } });
    },
    [p.readOnly, rf],
  );

  const openMenu = () => {
    // New steps attach after the selected step (or the last one), like Zapier's linear editor.
    const sel = p.workflow.nodes.find((n) => n.id === p.selectedId) ?? p.workflow.nodes.at(-1);
    if (sel) {
      const outs = NODES[sel.type].outputs(sel.config);
      const from = outs.length === 1 ? { source: sel.id, handle: outs[0].id } : undefined;
      setMenu({ pos: { x: sel.position.x + 330, y: sel.position.y }, from });
      return;
    }
    const r = wrapper.current?.getBoundingClientRect();
    const pos = r ? rf.screenToFlowPosition({ x: r.left + r.width / 2 - 116, y: r.top + r.height / 2 - 30 }) : { x: 0, y: 0 };
    setMenu({ pos });
  };

  const hasTrigger = p.workflow.nodes.some((n) => isTrigger(n.type));
  const empty = p.workflow.nodes.length === 0;

  return (
    <div ref={wrapper} className="relative h-full w-full bg-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        onPaneClick={() => p.onSelect?.(null)}
        nodesConnectable={!p.readOnly}
        elementsSelectable={!p.readOnly}
        deleteKeyCode={p.readOnly ? null : ["Backspace", "Delete"]}
        fitView
        fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
        minZoom={0.3}
        maxZoom={1.6}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color="var(--color-dot)" />
        {!p.readOnly && <Controls showInteractive={false} position="bottom-left" />}
      </ReactFlow>

      {!p.readOnly && empty && !menu && (
        <button
          onClick={openMenu}
          className="group absolute top-1/2 left-1/2 flex w-[264px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 rounded-lg border-2 border-dashed border-line-strong bg-paper/70 px-6 py-7 text-center transition hover:border-crimson"
        >
          <span className="grid size-11 place-items-center rounded-full bg-crimson text-paper transition group-hover:scale-105">
            <Plus size={22} />
          </span>
          <span className="mt-1 text-[15px] font-semibold text-ink">Add a trigger</span>
          <span className="text-[12.5px] text-muted">The event that starts this workflow</span>
        </button>
      )}

      {!p.readOnly && !empty && (
        <button
          onClick={openMenu}
          title="Add a step"
          className="absolute top-4 right-4 z-10 flex items-center gap-1.5 rounded-full bg-paper py-2 pr-4 pl-3 text-[14px] font-medium text-ink ring-1 ring-ink transition hover:bg-cream"
        >
          <Plus size={17} /> Add step
        </button>
      )}

      {menu && p.palette && (
        <AddNodeMenu
          palette={p.palette}
          hasTrigger={hasTrigger}
          onClose={() => setMenu(null)}
          onPick={(t) => {
            p.onAdd?.(t, menu.pos, menu.from);
            setMenu(null);
            // Keep the new step in view (the config panel narrows the canvas when it opens).
            window.setTimeout(() => rf.fitView({ padding: 0.25, maxZoom: 1, duration: 250 }), 80);
          }}
        />
      )}

      {toast && (
        <div className="animate-pop absolute top-16 left-1/2 z-20 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-[13px] text-paper">
          {toast}
        </div>
      )}
      {p.overlay}
    </div>
  );
}

export function Canvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
