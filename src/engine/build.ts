// Compact builder for reference and trap workflows in level files.
import { NODES } from "./nodes";
import type { Config, NodeType, Workflow } from "./types";

type NodeSpec = [id: string, type: NodeType, config?: Config];
type EdgeSpec = [source: string, target: string, handle?: string];

export function wf(nodes: NodeSpec[], edges: EdgeSpec[]): Workflow {
  return {
    nodes: nodes.map(([id, type, config], i) => ({
      id,
      type,
      position: { x: i * 280, y: 0 },
      config: { ...NODES[type].defaults(), ...(config ?? {}) },
    })),
    edges: edges.map(([source, target, handle], i) => ({
      id: `e${i}-${source}-${target}`,
      source,
      target,
      sourceHandle: handle ?? NODES[nodes.find((n) => n[0] === source)![1]].outputs({})[0]?.id ?? "out",
    })),
  };
}

/** Copy a workflow with one node's config patched. Used to build trap variants. */
export function patch(w: Workflow, nodeId: string, config: Config): Workflow {
  return {
    ...w,
    nodes: w.nodes.map((n) => (n.id === nodeId ? { ...n, config: { ...n.config, ...config } } : n)),
  };
}
