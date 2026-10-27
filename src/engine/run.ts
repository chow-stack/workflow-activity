import { handleOf, topoOrder, triggers } from "./graph";
import { NODES, type RunCtx } from "./nodes";
import { fireTimes, type ScheduleConfig } from "./schedule";
import type { Item, Level, Row, TestCase, Workflow, World } from "./types";

export const STEP_CAP = 500;

export interface NodeTrace {
  ran: boolean;
  inCount: number;
  out: Record<string, number>;
}

export interface Trace {
  order: string[];
  nodes: Record<string, NodeTrace>;
  edges: Record<string, number>; // edge id → items carried
  warnings: string[];
  runs: number; // how many times the trigger fired
}

export interface RunResult {
  world: World;
  trace: Trace;
  error?: string;
}

class CapError extends Error {}

const cloneRows = (sheets: Record<string, Row[]>) =>
  Object.fromEntries(Object.entries(sheets).map(([k, rows]) => [k, rows.map((r) => ({ ...r }))]));

/** Events the trigger produces for a test case. A trigger of the wrong kind never fires. */
export function triggerEvents(wf: Workflow, level: Level, test: TestCase): Item[] {
  const [t] = triggers(wf);
  if (!t) return [];
  const kind = t.type.split(".")[1];
  if (kind !== level.trigger) return [];
  if (kind === "schedule") {
    if (!test.input.window) return [];
    return fireTimes(t.config as unknown as ScheduleConfig, test.input.window).map((f) => ({ ...f }));
  }
  return (test.input.events ?? []).map((e) => ({ ...e }));
}

export function runTest(wf: Workflow, level: Level, test: TestCase): RunResult {
  const world: World = { sheets: cloneRows(test.input.sheets ?? {}), slack: [], emails: [], rows: [] };
  const order = topoOrder(wf);
  const trace: Trace = { order, nodes: {}, edges: {}, warnings: [], runs: 0 };
  for (const id of order) trace.nodes[id] = { ran: false, inCount: 0, out: {} };
  wf.edges.forEach((e) => (trace.edges[e.id] = 0));

  const warnings = new Set<string>();
  const ctx: RunCtx = { level, world, warn: (m) => warnings.add(m) };
  const byId = new Map(wf.nodes.map((n) => [n.id, n]));
  let steps = 0;

  try {
    for (const event of triggerEvents(wf, level, test)) {
      trace.runs++;
      const inputs = new Map<string, Item[]>();
      const [triggerId, ...rest] = order;
      const emit = (fromId: string, outputs: Record<string, Item[]>) => {
        const nt = trace.nodes[fromId];
        for (const [h, items] of Object.entries(outputs)) nt.out[h] = (nt.out[h] ?? 0) + items.length;
        for (const e of wf.edges) {
          if (e.source !== fromId) continue;
          const items = outputs[handleOf(e)] ?? [];
          if (items.length === 0) continue;
          trace.edges[e.id] = (trace.edges[e.id] ?? 0) + items.length;
          const list = inputs.get(e.target) ?? [];
          list.push(...items.map((it) => ({ ...it })));
          inputs.set(e.target, list);
        }
      };
      trace.nodes[triggerId].ran = true;
      trace.nodes[triggerId].inCount++;
      emit(triggerId, { out: [event] });

      for (const id of rest) {
        const items = inputs.get(id) ?? [];
        if (items.length === 0) continue;
        steps += items.length;
        if (steps > STEP_CAP) throw new CapError();
        const node = byId.get(id)!;
        const def = NODES[node.type];
        const nt = trace.nodes[id];
        nt.ran = true;
        nt.inCount += items.length;
        emit(id, def.run ? def.run(items, node.config, ctx) : { out: items });
      }
    }
  } catch (err) {
    trace.warnings = [...warnings];
    if (err instanceof CapError) return { world, trace, error: "The workflow ran too many steps." };
    return { world, trace, error: err instanceof Error ? err.message : String(err) };
  }
  trace.warnings = [...warnings];
  return { world, trace };
}
