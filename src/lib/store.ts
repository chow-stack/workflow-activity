"use client";

import { create } from "zustand";
import type { GradeResult } from "@/engine/grade";
import { wouldCreateCycle } from "@/engine/graph";
import { NODES, isTrigger } from "@/engine/nodes";
import type { Config, NodeType, Workflow } from "@/engine/types";
import { KEYS, load, save } from "./storage";

export interface Team {
  id: string;
  name: string;
}

export interface Progress {
  currentLevel: number;
  workflows: Record<number, Workflow>;
  hints: Record<number, number>;
  done: Record<number, { points: number; skipped: boolean }>;
  seenIntro: Record<number, boolean>;
}

export type NodeRunState = "idle" | "running" | "ran" | "skipped";

export interface Anim {
  active: boolean;
  nodes: Record<string, NodeRunState>;
  edges: Record<string, number>; // items carried, shown as a badge
  flowing: Record<string, boolean>;
}

const EMPTY: Workflow = { nodes: [], edges: [] };
const emptyProgress = (): Progress => ({ currentLevel: 1, workflows: {}, hints: {}, done: {}, seenIntro: {} });
const emptyAnim = (): Anim => ({ active: false, nodes: {}, edges: {}, flowing: {} });

interface PlayState {
  team: Team | null;
  progress: Progress;
  selectedId: string | null;
  grade: GradeResult | null;
  gradeStale: boolean;
  anim: Anim;
  drawerOpen: boolean;

  init: (team: Team, done?: Progress["done"]) => void;
  setLevel: (id: number) => void;
  workflow: () => Workflow;
  setWorkflow: (w: Workflow) => void;
  addNode: (type: NodeType, position: { x: number; y: number }, from?: { source: string; handle: string }) => string | null;
  updateConfig: (id: string, patch: Config) => void;
  removeNodes: (ids: string[]) => void;
  moveNode: (id: string, position: { x: number; y: number }) => void;
  connect: (source: string, handle: string, target: string) => string | null;
  removeEdges: (ids: string[]) => void;
  select: (id: string | null) => void;
  takeHint: () => void;
  markIntroSeen: (levelId: number) => void;
  markDone: (levelId: number, points: number, skipped: boolean) => void;
  setGrade: (g: GradeResult | null) => void;
  setAnim: (a: Partial<Anim>) => void;
  setDrawer: (open: boolean) => void;
}

const uid = () => Math.random().toString(36).slice(2, 7);

export const usePlay = create<PlayState>((set, get) => {
  const persist = () => {
    const { team, progress } = get();
    if (team) save(KEYS.progress(team.id), progress);
  };

  const editWorkflow = (fn: (w: Workflow) => Workflow) => {
    const { progress } = get();
    const lvl = progress.currentLevel;
    const next = fn(progress.workflows[lvl] ?? EMPTY);
    set({
      progress: { ...progress, workflows: { ...progress.workflows, [lvl]: next } },
      gradeStale: true,
      anim: emptyAnim(),
    });
    persist();
  };

  return {
    team: null,
    progress: emptyProgress(),
    selectedId: null,
    grade: null,
    gradeStale: false,
    anim: emptyAnim(),
    drawerOpen: false,

    init: (team, done) => {
      const stored = load<Progress>(KEYS.progress(team.id), emptyProgress());
      const merged: Progress = { ...emptyProgress(), ...stored, done: { ...stored.done, ...(done ?? {}) } };
      // Resume at the first level that isn't finished yet.
      const firstOpen = [1, 2, 3, 4, 5, 6, 7, 8].find((l) => !merged.done[l]) ?? 8;
      if (!merged.currentLevel || merged.currentLevel > firstOpen) merged.currentLevel = firstOpen;
      set({ team, progress: merged, grade: null, selectedId: null, anim: emptyAnim(), drawerOpen: false });
      save(KEYS.progress(team.id), merged);
    },

    setLevel: (id) => {
      set({ progress: { ...get().progress, currentLevel: id }, grade: null, selectedId: null, anim: emptyAnim(), drawerOpen: false });
      persist();
    },

    workflow: () => get().progress.workflows[get().progress.currentLevel] ?? EMPTY,
    setWorkflow: (w) => editWorkflow(() => w),

    addNode: (type, position, from) => {
      const w = get().workflow();
      if (isTrigger(type) && w.nodes.some((n) => isTrigger(n.type))) return null;
      const id = `${type.split(".")[1]}-${uid()}`;
      editWorkflow((wf) => ({
        nodes: [...wf.nodes, { id, type, position, config: NODES[type].defaults() }],
        edges: from ? [...wf.edges, { id: `e-${uid()}`, source: from.source, sourceHandle: from.handle, target: id }] : wf.edges,
      }));
      set({ selectedId: id });
      return id;
    },

    updateConfig: (id, patch) =>
      editWorkflow((wf) => {
        const nodes = wf.nodes.map((n) => (n.id === id ? { ...n, config: { ...n.config, ...patch } } : n));
        // Drop edges from Switch handles that no longer exist.
        const node = nodes.find((n) => n.id === id)!;
        const handles = new Set(NODES[node.type].outputs(node.config).map((h) => h.id));
        const edges = wf.edges.filter((e) => e.source !== id || handles.has(e.sourceHandle ?? "out"));
        return { nodes, edges };
      }),

    removeNodes: (ids) => {
      const gone = new Set(ids);
      editWorkflow((wf) => ({
        nodes: wf.nodes.filter((n) => !gone.has(n.id)),
        edges: wf.edges.filter((e) => !gone.has(e.source) && !gone.has(e.target)),
      }));
      if (get().selectedId && gone.has(get().selectedId!)) set({ selectedId: null });
    },

    moveNode: (id, position) => {
      // Moving nodes doesn't invalidate results.
      const { progress } = get();
      const lvl = progress.currentLevel;
      const wf = progress.workflows[lvl] ?? EMPTY;
      set({
        progress: {
          ...progress,
          workflows: { ...progress.workflows, [lvl]: { ...wf, nodes: wf.nodes.map((n) => (n.id === id ? { ...n, position } : n)) } },
        },
      });
      persist();
    },

    connect: (source, handle, target) => {
      const w = get().workflow();
      const tgt = w.nodes.find((n) => n.id === target);
      if (!tgt || isTrigger(tgt.type)) return "Triggers can't have inputs.";
      if (wouldCreateCycle(w, source, target)) return "That would make a loop back to an earlier step.";
      if (w.edges.some((e) => e.source === source && (e.sourceHandle ?? "out") === handle && e.target === target)) return null;
      editWorkflow((wf) => ({ ...wf, edges: [...wf.edges, { id: `e-${uid()}`, source, sourceHandle: handle, target }] }));
      return null;
    },

    removeEdges: (ids) => {
      const gone = new Set(ids);
      editWorkflow((wf) => ({ ...wf, edges: wf.edges.filter((e) => !gone.has(e.id)) }));
    },

    select: (id) => set({ selectedId: id }),

    takeHint: () => {
      const { progress } = get();
      const lvl = progress.currentLevel;
      set({ progress: { ...progress, hints: { ...progress.hints, [lvl]: Math.min(2, (progress.hints[lvl] ?? 0) + 1) } } });
      persist();
    },

    markIntroSeen: (levelId) => {
      const { progress } = get();
      set({ progress: { ...progress, seenIntro: { ...progress.seenIntro, [levelId]: true } } });
      persist();
    },

    markDone: (levelId, points, skipped) => {
      const { progress } = get();
      if (progress.done[levelId]) return;
      set({ progress: { ...progress, done: { ...progress.done, [levelId]: { points, skipped } } } });
      persist();
    },

    setGrade: (g) => set({ grade: g, gradeStale: false }),
    setAnim: (a) => set({ anim: { ...get().anim, ...a } }),
    setDrawer: (open) => set({ drawerOpen: open }),
  };
});
