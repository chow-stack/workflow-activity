import { describe, expect, it } from "vitest";
import { gradeLevel } from "@/engine/grade";
import { validate } from "@/engine/validate";
import { DEMO, LEVELS } from "@/levels";

describe.each([DEMO, ...LEVELS].map((l) => [l.id, l.title, l] as const))("Level %i · %s", (_id, _title, level) => {
  it("reference solution is valid and passes every test", () => {
    const ref = level.reference!;
    expect(validate(ref, level)).toEqual([]);
    const r = gradeLevel(ref, level);
    const failing = r.tests.filter((t) => !t.passed).map((t) => `${t.id}: ${t.messages.join(" | ")}`);
    expect(failing).toEqual([]);
    expect(r.passed).toBe(true);
  });

  it("reference produces no warnings", () => {
    const r = gradeLevel(level.reference!, level);
    expect(r.tests.flatMap((t) => t.trace.warnings)).toEqual([]);
  });

  it.each(level.traps.map((t) => [t.name, t] as const))("trap “%s” fails the tests it targets", (_n, trap) => {
    expect(validate(trap.workflow, level)).toEqual([]);
    const r = gradeLevel(trap.workflow, level);
    const failed = r.tests.filter((t) => !t.passed).map((t) => t.id);
    for (const id of trap.shouldFail) expect(failed).toContain(id);
    expect(r.passed).toBe(false);
  });

  it("uses only nodes from its palette in the reference", () => {
    for (const n of level.reference!.nodes) expect(level.palette).toContain(n.type);
  });
});
