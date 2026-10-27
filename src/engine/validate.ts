import { reachable, triggers } from "./graph";
import { NODES } from "./nodes";
import type { Level, Workflow } from "./types";

export interface Issue {
  nodeId?: string;
  message: string;
}

/** Blocking problems that stop a run. */
export function validate(wf: Workflow, level: Level): Issue[] {
  const issues: Issue[] = [];
  const ts = triggers(wf);
  if (ts.length === 0) issues.push({ message: "Add a trigger: every workflow starts with one." });
  if (ts.length > 1) issues.push({ message: "Use only one trigger per workflow." });

  const live = reachable(wf);
  for (const n of wf.nodes) {
    const def = NODES[n.type];
    if (ts.length === 1 && !live.has(n.id)) {
      issues.push({ nodeId: n.id, message: `${def.label} isn't connected to the trigger.` });
      continue;
    }
    const err = def.validate(n.config, level);
    if (err) issues.push({ nodeId: n.id, message: `${def.label}: ${err}` });
  }
  return issues;
}
