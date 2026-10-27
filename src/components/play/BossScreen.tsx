"use client";

import { Check, LoaderCircle, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { boss } from "@/levels";
import { usePlay } from "@/lib/store";
import { submitBoss } from "@/lib/teams";
import { Canvas } from "../canvas/Canvas";
import { fieldsInto } from "@/engine/fields";
import { ConfigPanel } from "../panels/ConfigPanel";
import { inputCls } from "../panels/fields";

export function BossScreen() {
  const s = usePlay();
  const [title, setTitle] = useState("");
  const [problem, setProblem] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (s.progress.currentLevel !== boss.id) s.setLevel(boss.id);
  }, [s]);

  const wf = s.workflow();
  const selected = wf.nodes.find((n) => n.id === s.selectedId);

  const submit = async () => {
    if (!s.team) return;
    if (!title.trim() || !problem.trim()) return setError("Add a title and the problem it solves.");
    if (wf.nodes.length < 2) return setError("Build at least a trigger and one step.");
    setError(null);
    setState("saving");
    const err = await submitBoss(s.team.id, title, problem, wf);
    if (err) {
      setError(err);
      setState("idle");
    } else setState("saved");
  };

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-[340px] shrink-0 flex-col overflow-y-auto border-r border-line bg-cream px-6 py-6">
        <div className="text-[11.5px] font-medium tracking-wider text-crimson uppercase">Boss round</div>
        <h1 className="mt-2 font-display text-[30px] leading-[1.1] font-medium">{boss.title}</h1>
        <p className="mt-4 text-[14.5px] leading-relaxed">{boss.brief}</p>
        <p className="mt-3 text-[12.5px] text-ink-muted">
          Every step is unlocked. Nothing runs here, so design it the way it would work for real.
        </p>

        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1.5 flex justify-between text-[12.5px] font-medium">
              Title <span className="font-normal text-ink-muted">{title.length}/60</span>
            </span>
            <input value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} placeholder="Syllabus → calendar" className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1.5 flex justify-between text-[12.5px] font-medium">
              Problem it solves <span className="font-normal text-ink-muted">{problem.length}/140</span>
            </span>
            <textarea
              value={problem}
              maxLength={140}
              rows={3}
              onChange={(e) => setProblem(e.target.value)}
              placeholder="I miss deadlines because they're buried in six different syllabi."
              className={`${inputCls} resize-none`}
            />
          </label>
          {error && <div className="text-[12.5px] text-fail">{error}</div>}
          <button
            onClick={submit}
            disabled={state === "saving"}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-crimson px-4 py-3 font-medium text-white hover:bg-crimson-dark disabled:opacity-70"
          >
            {state === "saving" ? <LoaderCircle size={17} className="animate-spin" /> : state === "saved" ? <Check size={17} /> : <Send size={16} />}
            {state === "saved" ? "Submitted · submit again to update" : "Submit design"}
          </button>
        </div>
      </aside>
      <main className="relative min-w-0 flex-1">
        <Canvas
          key="boss"
          workflow={wf}
          palette={boss.palette}
          selectedId={s.selectedId}
          onAdd={(t, pos, from) => {
            s.addNode(t, pos, from);
            setState("idle");
          }}
          onMove={s.moveNode}
          onRemoveNodes={s.removeNodes}
          onRemoveEdges={s.removeEdges}
          onConnect={s.connect}
          onSelect={s.select}
        />
      </main>
      {selected && (
        <ConfigPanel
          key={selected.id}
          node={selected}
          level={boss}
          fields={fieldsInto(wf, boss, selected.id)}
          onChange={(patch) => {
            s.updateConfig(selected.id, patch);
            setState("idle");
          }}
          onDelete={() => s.removeNodes([selected.id])}
          onClose={() => s.select(null)}
        />
      )}
    </div>
  );
}
