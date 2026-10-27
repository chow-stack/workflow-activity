import { NODES } from "./nodes";
import type { FieldInfo, Level, Workflow } from "./types";

/** Fields available as input to a node, computed statically from upstream node configs. */
export function fieldsInto(wf: Workflow, level: Level, nodeId: string): FieldInfo[] {
  const memo = new Map<string, FieldInfo[]>();

  const outOf = (id: string, visiting: Set<string>): FieldInfo[] => {
    if (memo.has(id)) return memo.get(id)!;
    const node = wf.nodes.find((n) => n.id === id);
    if (!node || visiting.has(id)) return [];
    visiting.add(id);
    const out = NODES[node.type].outputFields(node.config, into(id, visiting), level);
    visiting.delete(id);
    memo.set(id, out);
    return out;
  };

  const into = (id: string, visiting: Set<string>): FieldInfo[] => {
    const merged = new Map<string, FieldInfo>();
    for (const e of wf.edges) {
      if (e.target !== id) continue;
      for (const f of outOf(e.source, visiting)) if (!merged.has(f.name)) merged.set(f.name, f);
    }
    return [...merged.values()];
  };

  return into(nodeId, new Set());
}
