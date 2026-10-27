"use client";

import { LoaderCircle, Play, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { fieldsInto } from "@/engine/fields";
import { gradeLevel } from "@/engine/grade";
import { topoOrder } from "@/engine/graph";
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
import { Button } from "../ui";
import { GuideBar } from "./GuideBar";
import { LevelIntro } from "./LevelIntro";

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
  // Unfinished steps always show a to-do on their card; after a Run attempt they turn red.
  const issueMap = useMemo(
    () => Object.fromEntries(issues.filter((i) => i.nodeId).map((i) => [i.nodeId!, i.message.replace(/^[^:]+: /, "")])),
    [issues],
  );
  const stepOf = useMemo(() => Object.fromEntries(topoOrder(wf).map((id, i) => [id, i + 1])), [wf]);
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
  const blocked = attempted && issues.length > 0;
  const passedCount = s.grade?.tests.filter((t) => t.passed).length ?? 0;

  return (
    <div className="relative flex min-h-0 flex-1">
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
            strict={attempted}
            overlay={
              <>
                <div className="pointer-events-none absolute top-4 right-36 left-4 z-10 flex">
                  <GuideBar
                    workflow={wf}
                    issues={issues}
                    cleared={Boolean(done && !done.skipped && s.grade?.passed)}
                    failed={Boolean(s.grade && s.grade.tests.length && !s.grade.passed && !s.gradeStale)}
                    onFocus={s.select}
                  />
                </div>
                <div className="pointer-events-none absolute right-4 bottom-4 z-10 flex flex-col items-end gap-2">
                  {blocked && (
                    <div className="animate-pop pointer-events-auto flex max-w-[340px] gap-2 rounded-lg bg-fail-soft px-3.5 py-2.5 text-[13px] text-fail ring-1 ring-fail/30">
                      <TriangleAlert size={15} className="mt-0.5 shrink-0" />
                      <span>{issues.find((i) => !i.nodeId)?.message ?? "Finish setting up the steps marked in red, then run again."}</span>
                    </div>
                  )}
                  <div className="pointer-events-auto flex items-center gap-2">
                    {s.grade && !s.drawerOpen && s.grade.tests.length > 0 && !running && (
                      <Button variant="secondary" onClick={() => s.setDrawer(true)}>
                        Results {passedCount}/{s.grade.tests.length}
                      </Button>
                    )}
                    <Button size="lg" onClick={run} disabled={running} className="shadow-[0_6px_20px_rgb(152_27_37/0.3)]">
                      {running ? <LoaderCircle size={18} className="animate-spin" /> : <Play size={17} fill="currentColor" />}
                      {running ? "Running…" : "Run tests"}
                    </Button>
                  </div>
                </div>
              </>
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

      {!s.progress.seenIntro[level.id] && <LevelIntro level={level} onStart={() => s.markIntroSeen(level.id)} />}

      {selected && (
        <ConfigPanel
          key={selected.id}
          node={selected}
          step={stepOf[selected.id]}
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
