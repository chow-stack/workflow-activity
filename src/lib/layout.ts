import { topoOrder } from "@/engine/graph";
import type { Workflow } from "@/engine/types";

const COL = 340; // horizontal gap between steps
const ROW = 170; // vertical gap between branches

/** Left-to-right layout by depth from the trigger, with branches stacked and centered. Used for read-only solutions. */
export function autoLayout(wf: Workflow): Workflow {
  const order = topoOrder(wf);
  const depth: Record<string, number> = {};
  for (const id of order) {
    const parents = wf.edges.filter((e) => e.target === id).map((e) => depth[e.source] ?? 0);
    depth[id] = parents.length ? Math.max(...parents) + 1 : 0;
  }
  const columns: string[][] = [];
  for (const id of order) (columns[depth[id]] ??= []).push(id);
  const pos: Record<string, { x: number; y: number }> = {};
  columns.forEach((ids, d) => ids.forEach((id, i) => (pos[id] = { x: d * COL, y: (i - (ids.length - 1) / 2) * ROW })));
  return { ...wf, nodes: wf.nodes.map((n) => ({ ...n, position: pos[n.id] ?? n.position })) };
}
