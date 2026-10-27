import { isTrigger } from "./nodes";
import type { WfEdge, Workflow } from "./types";

export const handleOf = (e: WfEdge) => e.sourceHandle ?? "out";

export function triggers(wf: Workflow) {
  return wf.nodes.filter((n) => isTrigger(n.type));
}

/** Node ids reachable from the (single) trigger, including the trigger itself. */
export function reachable(wf: Workflow): Set<string> {
  const [t] = triggers(wf);
  const seen = new Set<string>();
  if (!t) return seen;
  const stack = [t.id];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const e of wf.edges) if (e.source === id) stack.push(e.target);
  }
  return seen;
}

/** Topological order of the reachable subgraph (Kahn). */
export function topoOrder(wf: Workflow): string[] {
  const live = reachable(wf);
  const indeg = new Map<string, number>();
  live.forEach((id) => indeg.set(id, 0));
  const edges = wf.edges.filter((e) => live.has(e.source) && live.has(e.target));
  for (const e of edges) indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
  const queue = [...live].filter((id) => indeg.get(id) === 0);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const e of edges) {
      if (e.source !== id) continue;
      const d = (indeg.get(e.target) ?? 0) - 1;
      indeg.set(e.target, d);
      if (d === 0) queue.push(e.target);
    }
  }
  return order;
}

export function wouldCreateCycle(wf: Workflow, source: string, target: string): boolean {
  if (source === target) return true;
  const stack = [target];
  const seen = new Set<string>();
  while (stack.length) {
    const id = stack.pop()!;
    if (id === source) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const e of wf.edges) if (e.source === id) stack.push(e.target);
  }
  return false;
}
