"use client";

import { LoaderCircle, Play, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { fieldsInto } from "@/engine/fields";
import { gradeLevel } from "@/engine/grade";
import { NODES } from "@/engine/nodes";
import { validate } from "@/engine/validate";
import type { Level } from "@/engine/types";
import { LEVELS } from "@/levels";
import { pointsFor } from "@/lib/scoring";
import { usePlay, type NodeRunState } from "@/lib/store";
import { recordCompletion } from "@/lib/teams";
import { Canvas } from "../canvas/Canvas";
import { BriefPanel } from "../panels/BriefPanel";
import { ConfigPanel } from "../panels/ConfigPanel";
import { ResultsDrawer } from "../panels/ResultsDrawer";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function Workspace({ level, online }: { level: Level; online: boolean }) {
  const s = usePlay();
  const wf = s.workflow();
  const [attempted, setAttempted] = useState(false);
  const [running, setRunning] = useState(false);
  const runId = useRef(0);

  // Cancel an in-flight run animation when leaving the level (the parent keys this by level).
  useEffect(() => {
    const r = runId;
    return () => {
      r.current++;
    };
  }, []);

  const issues = useMemo(() => validate(wf, level), [wf, level]);
  const issueMap = useMemo(
    () => (attempted ? Object.fromEntries(issues.filter((i) => i.nodeId).map((i) => [i.nodeId!, i.message])) : {}),
    [issues, attempted],
  );
  const selected = wf.nodes.find((n) => n.id === s.selectedId);
  const hints = s.progress.hints[level.id] ?? 0;
  const done = s.progress.done[level.id];

  const run = async () => {
    setAttempted(true);
    if (issues.length) return;
    const id = ++runId.current;
    const result = gradeLevel(wf, level);
    const trace = result.tests[0]?.trace;
    setRunning(true);
    s.setDrawer(false);
    s.select(null);

    // Animate the first test only: nodes light up in execution order, edges carry items.
    if (trace) {
      const nodes: Record<string, NodeRunState> = {};
      const edges: Record<string, number> = {};
      s.setAnim({ active: true, nodes: {}, edges: {}, flowing: {} });
      for (const nid of trace.order) {
        if (runId.current !== id) return;
        const node = wf.nodes.find((n) => n.id === nid)!;
        if (!trace.nodes[nid]?.ran) {
          nodes[nid] = "skipped";
          continue;
        }
        nodes[nid] = "running";
        s.setAnim({ nodes: { ...nodes } });
        await sleep(NODES[node.type].category === "ai" ? 650 : 300);
        nodes[nid] = "ran";
        const out = wf.edges.filter((e) => e.source === nid && (trace.edges[e.id] ?? 0) > 0);
        const flowing = Object.fromEntries(out.map((e) => [e.id, true]));
        for (const e of out) edges[e.id] = trace.edges[e.id];
        s.setAnim({ nodes: { ...nodes }, edges: { ...edges }, flowing });
        if (out.length) await sleep(320);
      }
      if (runId.current !== id) return;
      s.setAnim({ active: false, nodes: { ...nodes }, edges: { ...edges }, flowing: {} });
    }

    s.setGrade(result);
    s.setDrawer(true);
    setRunning(false);

    if (result.passed && !done && s.team) {
      const pts = pointsFor(level.points, hints);
      s.markDone(level.id, pts, false);
      if (online) recordCompletion(s.team.id, level.id, pts, hints, false);
    }
  };

  const skip = () => {
    if (!s.team) return;
    s.markDone(level.id, 0, true);
    if (online) recordCompletion(s.team.id, level.id, 0, hints, true);
    if (level.id < LEVELS.length) s.setLevel(level.id + 1);
  };

  const showDrawer = s.drawerOpen && s.grade && s.grade.tests.length > 0;
  const blocking = attempted ? issues : [];

  return (
    <div className="flex min-h-0 flex-1">
      <BriefPanel level={level} hintsUsed={hints} done={done} onHint={s.takeHint} onSkip={skip} />

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="relative min-h-0 flex-1">
          <Canvas
            key={level.id}
            workflow={wf}
            palette={level.palette}
            selectedId={s.selectedId}
            issues={issueMap}
            anim={s.anim}
            onAdd={(t, pos, from) => s.addNode(t, pos, from)}
            onMove={s.moveNode}
            onRemoveNodes={s.removeNodes}
            onRemoveEdges={s.removeEdges}
            onConnect={s.connect}
            onSelect={s.select}
          fitKey={Boolean(showDrawer)}
            overlay={
              <div className="pointer-events-none absolute right-4 bottom-4 z-10 flex flex-col items-end gap-2">
                {blocking.length > 0 && (
                  <div className="animate-pop pointer-events-auto max-w-[360px] rounded-xl bg-[#2f1a1a] p-3 text-[12.5px] text-[#ffc9c9] ring-1 ring-fail/40">
                    <div className="mb-1 flex items-center gap-1.5 font-medium">
                      <TriangleAlert size={14} /> Fix these before running
                    </div>
                    <ul className="list-disc space-y-0.5 pl-5">
                      {blocking.slice(0, 5).map((i, k) => (
                        <li key={k}>
                          {i.nodeId ? (
                            <button className="text-left underline-offset-2 hover:underline" onClick={() => s.select(i.nodeId!)}>
                              {i.message}
                            </button>
                          ) : (
                            i.message
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {s.grade && !s.drawerOpen && s.grade.tests.length > 0 && !running && (
                  <button
                    onClick={() => s.setDrawer(true)}
                    className="pointer-events-auto rounded-lg bg-node px-3 py-2 text-[13px] text-node-text ring-1 ring-node-border hover:bg-node-hover"
                  >
                    Show results ({s.grade.tests.filter((t) => t.passed).length}/{s.grade.tests.length})
                  </button>
                )}
                <button
                  onClick={run}
                  disabled={running}
                  className="pointer-events-auto flex items-center gap-2 rounded-xl bg-crimson px-5 py-3 text-[15px] font-medium text-white shadow-[0_8px_24px_rgb(152_27_37/0.45)] transition hover:bg-[#ad202b] disabled:opacity-70"
                >
                  {running ? <LoaderCircle size={18} className="animate-spin" /> : <Play size={18} fill="currentColor" />}
                  {running ? "Running…" : "Run tests"}
                </button>
              </div>
            }
          />
        </div>
        {showDrawer && (
          <ResultsDrawer
            key={`${level.id}-${s.grade!.tests.map((t) => t.passed).join()}`}
            level={level}
            grade={s.grade!}
            stale={s.gradeStale}
            earned={s.grade!.passed ? (done?.points ?? null) : null}
            hasNext={level.id < LEVELS.length}
            onNext={() => s.setLevel(level.id + 1)}
            onClose={() => s.setDrawer(false)}
          />
        )}
      </main>

      {selected && (
        <ConfigPanel
          key={selected.id}
          node={selected}
          level={level}
          fields={fieldsInto(wf, level, selected.id)}
          issue={issueMap[selected.id]}
          onChange={(patch) => s.updateConfig(selected.id, patch)}
          onDelete={() => s.removeNodes([selected.id])}
          onClose={() => s.select(null)}
        />
      )}
    </div>
  );
}
