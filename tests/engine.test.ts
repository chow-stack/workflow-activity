import { describe, expect, it } from "vitest";
import * as ai from "@/engine/ai";
import { wf } from "@/engine/build";
import { evalCondition } from "@/engine/conditions";
import { numbersIn } from "@/engine/grade";
import { wouldCreateCycle } from "@/engine/graph";
import { runTest, STEP_CAP } from "@/engine/run";
import { fireTimes } from "@/engine/schedule";
import { render } from "@/engine/template";
import type { Level } from "@/engine/types";
import { LEVELS } from "@/levels";

describe("conditions", () => {
  it("compares numbers numerically and strings case-insensitively", () => {
    expect(evalCondition({ field: "x", op: "gte", value: "3.3" }, { x: 3.3 })).toBe(true);
    expect(evalCondition({ field: "x", op: "gt", value: "3.3" }, { x: "3.3" })).toBe(false);
    expect(evalCondition({ field: "x", op: "lt", value: "10" }, { x: "9" })).toBe(true);
    expect(evalCondition({ field: "x", op: "equals", value: "unpaid" }, { x: "Unpaid " })).toBe(true);
    expect(evalCondition({ field: "x", op: "gt", value: "3" }, { x: "3.45/4.0" })).toBe(false);
  });
  it("resolves templates on the right-hand side", () => {
    expect(evalCondition({ field: "stock", op: "lt", value: "{{reorder}}" }, { stock: 2, reorder: 6 })).toBe(true);
  });
  it("handles lists", () => {
    const item = { skills: ["Advanced Excel modeling", "R"] };
    expect(evalCondition({ field: "skills", op: "contains", value: "excel" }, item)).toBe(true);
    expect(evalCondition({ field: "skills", op: "notContains", value: "excel" }, item)).toBe(false);
    expect(evalCondition({ field: "skills", op: "empty", value: "" }, { skills: [] })).toBe(true);
  });
  it("ends with any of", () => {
    const c = { field: "from", op: "endsWithAny" as const, value: "a.com, b.com" };
    expect(evalCondition(c, { from: "x@b.com" })).toBe(true);
    expect(evalCondition(c, { from: "x@b.com.evil.biz" })).toBe(false);
  });
});

describe("template", () => {
  it("renders tokens and reports missing ones", () => {
    const missing = new Set<string>();
    expect(render("Hi {{ name }} {{nope}}", { name: "Ava" }, missing)).toBe("Hi Ava ");
    expect([...missing]).toEqual(["nope"]);
  });
});

describe("schedule", () => {
  const week = { startWeekday: 0, days: 7 };
  it("fires weekly, daily and hourly", () => {
    expect(fireTimes({ frequency: "week", weekday: 1, time: "08:00" }, week).map((f) => f.fired_at)).toEqual(["Mon 08:00"]);
    expect(fireTimes({ frequency: "day", weekday: 0, time: "08:00" }, week)).toHaveLength(7);
    expect(fireTimes({ frequency: "hour", weekday: 0, time: "08:15" }, week)).toHaveLength(168);
  });
});

describe("simulated AI", () => {
  const fx = { classify: { "hello there": "positive" }, extract: { r: { gpa: "3.45/4.0", skills: ["Excel"] } } };
  it("classify needs the label offered and the right text", () => {
    expect(ai.classify(fx, "hello there", "positive, negative")).toBe("positive");
    expect(ai.classify(fx, "hello there", "negative")).toBe("unknown");
    expect(ai.classify(fx, "someone", "positive")).toBe("unknown");
  });
  it("extract matches aliases and coerces types", () => {
    expect(ai.extract(fx, "r", [{ name: "GPA", type: "number" }])).toEqual({ GPA: 3.45 });
    expect(ai.extract(fx, "r", [{ name: "grade_point_average", type: "text" }])).toEqual({ grade_point_average: "3.45/4.0" });
    expect(ai.extract(fx, "r", [{ name: "hobbies", type: "text" }])).toEqual({ hobbies: null });
  });
  it("write only fills slots referenced in the instructions", () => {
    const w = { write: { template: "Hi {client}, {amount}.", format: { amount: "${v}" }, fallbacks: { client: "there", amount: "the balance" } } };
    expect(ai.write(w, "to {{client}}", { client: "Bloom", amount: 5 })).toBe("Hi Bloom, the balance.");
    expect(ai.write(w, "{{client}} {{amount}}", { client: "Bloom", amount: 5 })).toBe("Hi Bloom, $5.");
  });
});

describe("graph + run", () => {
  it("detects cycles", () => {
    const w = wf([["a", "trigger.form"], ["b", "action.slack"], ["c", "action.slack"]], [["a", "b"], ["b", "c"]]);
    expect(wouldCreateCycle(w, "c", "b")).toBe(true);
    expect(wouldCreateCycle(w, "a", "c")).toBe(false);
  });

  it("combine with zero items produces nothing", () => {
    const l8 = LEVELS[7]; // Invoice Chaser: Combine feeds the #owner summary
    const r = runTest(l8.reference, l8, l8.tests[1]);
    expect(r.world.slack).toEqual([]);
    expect(r.trace.nodes["sum"].ran).toBe(false);
  });

  it("stops runaway workflows", () => {
    const level: Level = { ...LEVELS[6], tests: [] };
    const w = wf(
      [
        ["s", "trigger.schedule", { frequency: "hour", time: "00:00" }],
        ["read", "data.readSheet", { sheet: "Inventory" }],
        ["each", "data.forEach", { field: "rows" }],
        ["m", "action.slack", { channel: "#general", message: "{{item}}" }],
      ],
      [["s", "read"], ["read", "each"], ["each", "m"]],
    );
    const rows = Array.from({ length: 30 }, (_, i) => ({ item: `x${i}`, stock: 1, reorder_level: 2, unit: "u" }));
    const r = runTest(w, level, { id: "x", label: "x", hidden: false, input: { window: { startWeekday: 0, days: 1 }, sheets: { Inventory: rows } }, expect: {} });
    expect(r.error).toMatch(/too many steps/);
    expect(STEP_CAP).toBe(500);
  });
});

describe("grading helpers", () => {
  it("finds money-style numbers", () => {
    expect(numbersIn("3 overdue invoices, $4,250 outstanding")).toEqual([3, 4250]);
    expect(numbersIn("$4250.00")).toEqual([4250]);
  });
});
