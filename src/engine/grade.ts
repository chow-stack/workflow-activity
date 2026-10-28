import { toNumber } from "./conditions";
import { runTest, type Trace } from "./run";
import { validate, type Issue } from "./validate";
import type {
  AppendedRow,
  Email,
  EmailExpect,
  Level,
  RowExpect,
  SlackExpect,
  SlackMsg,
  TestCase,
  Workflow,
  World,
} from "./types";

/** One line in the results panel: something that should happen, or something the workflow did. */
export interface CheckLine {
  kind: "slack" | "email" | "row";
  text: string;
  ok: boolean; // expected: it happened · actual: it was supposed to happen
}

export interface TestResult {
  id: string;
  label: string;
  hidden: boolean;
  passed: boolean;
  messages: string[]; // plain-sentence summary (also used by tests)
  expected: CheckLine[]; // what should happen, each marked done or missing
  actual: CheckLine[]; // what the workflow did, each marked right or unexpected
  problem?: string; // run-level failure, e.g. the trigger never fired
  hint?: string; // the level's tip for this test
  world: World;
  trace: Trace;
}

export interface GradeResult {
  issues: Issue[];
  tests: TestResult[];
  passed: boolean;
}

const lc = (s: string) => s.trim().toLowerCase();

export function numbersIn(text: string): number[] {
  return [...text.matchAll(/\$?\d[\d,]*(\.\d+)?/g)].map((m) => Number(m[0].replace(/[$,]/g, "")));
}

const hasAll = (text: string, needles: string[] = []) => needles.every((n) => lc(text).includes(lc(n)));
const hasNone = (text: string, needles: string[] = []) => needles.every((n) => !lc(text).includes(lc(n)));
const hasNumbers = (text: string, nums: number[] = []) => {
  const found = numbersIn(text);
  return nums.every((n) => found.some((f) => Math.abs(f - n) < 0.005));
};

export function slackMatches(e: SlackExpect, a: SlackMsg): boolean {
  return (
    lc(e.channel) === lc(a.channel) &&
    hasAll(a.text, e.includes) &&
    hasNumbers(a.text, e.includesNumber) &&
    (e.at === undefined || e.at === a.at)
  );
}

export function emailMatches(e: EmailExpect, a: Email): boolean {
  return (
    lc(e.to) === lc(a.to) &&
    hasAll(a.subject, e.subjectIncludes) &&
    hasAll(a.body, e.bodyIncludes) &&
    hasNone(a.body, e.bodyExcludes) &&
    hasNumbers(`${a.subject} ${a.body}`, e.includesNumber)
  );
}

export function rowMatches(e: RowExpect, a: AppendedRow): boolean {
  if (lc(e.sheet) !== lc(a.sheet)) return false;
  return Object.entries(e.match).every(([col, want]) => {
    const got = a.row[col];
    const wn = toNumber(want);
    const gn = toNumber(got);
    if (wn !== null && gn !== null) return wn === gn;
    return lc(String(got ?? "")) === lc(String(want ?? ""));
  });
}

/** One-to-one matching of expected vs actual outputs (Kuhn's algorithm). */
function matchAll<E, A>(exp: E[], act: A[], fn: (e: E, a: A) => boolean) {
  const owner = new Array<number>(act.length).fill(-1);
  const tryAssign = (ei: number, seen: boolean[]): boolean => {
    for (let ai = 0; ai < act.length; ai++) {
      if (seen[ai] || !fn(exp[ei], act[ai])) continue;
      seen[ai] = true;
      if (owner[ai] === -1 || tryAssign(owner[ai], seen)) {
        owner[ai] = ei;
        return true;
      }
    }
    return false;
  };
  const matched = new Set<number>();
  exp.forEach((_, ei) => {
    if (tryAssign(ei, new Array(act.length).fill(false))) matched.add(ei);
  });
  return {
    matched,
    owner,
    missing: exp.filter((_, ei) => !matched.has(ei)),
    extra: act.filter((_, ai) => owner[ai] === -1),
  };
}

const quote = (s: string) => {
  const one = s.replace(/\s+/g, " ").trim();
  return `“${one.length > 70 ? one.slice(0, 67) + "…" : one}”`;
};
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const describeSlackExpect = (e: SlackExpect) =>
  `a Slack message in ${e.channel}` +
  (e.includes?.length ? ` mentioning ${e.includes.map(quote).join(", ")}` : "") +
  (e.includesNumber?.length ? ` with ${e.includesNumber.join(" and ")}` : "") +
  (e.at ? ` sent ${e.at}` : "");
const describeSlack = (a: SlackMsg) => `Slack message in ${a.channel}${a.at ? ` (${a.at})` : ""}: ${quote(a.text || "(empty)")}`;

const describeEmailExpect = (e: EmailExpect) =>
  `an email to ${e.to}` +
  (e.bodyIncludes?.length ? ` mentioning ${e.bodyIncludes.map(quote).join(", ")}` : "") +
  (e.includesNumber?.length ? ` with ${e.includesNumber.join(" and ")}` : "") +
  (e.bodyExcludes?.length ? ` without ${e.bodyExcludes.map(quote).join(", ")}` : "");
const describeEmail = (a: Email) => `Email to ${a.to || "(nobody)"}: ${quote(a.body || a.subject || "(empty)")}`;

const describeRowExpect = (e: RowExpect) =>
  `a row in ${e.sheet} with ${Object.entries(e.match)
    .map(([k, v]) => `${k} = ${v}`)
    .join(", ")}`;
const describeRow = (a: AppendedRow) =>
  `Row in ${a.sheet}: ${Object.entries(a.row)
    .map(([k, v]) => `${k} = ${v === "" ? "(blank)" : v}`)
    .join(", ")}`;

interface Compared {
  messages: string[];
  expected: CheckLine[];
  actual: CheckLine[];
}

function compare<E, A>(
  kind: CheckLine["kind"],
  noun: string,
  exp: E[],
  act: A[],
  fn: (e: E, a: A) => boolean,
  descE: (e: E) => string,
  descA: (a: A) => string,
): Compared {
  const { matched, owner, missing, extra } = matchAll(exp, act, fn);
  const expected = exp.map((e, i) => ({ kind, text: cap(descE(e)), ok: matched.has(i) }));
  const actual = act.map((a, i) => ({ kind, text: descA(a), ok: owner[i] !== -1 }));
  const messages: string[] = [];
  if (missing.length || extra.length) {
    if (exp.length !== act.length) messages.push(`Your workflow made ${plural(act.length, noun)}, but it should make ${exp.length}.`);
    missing.slice(0, 3).forEach((e) => messages.push(`Should have made ${descE(e)}.`));
    if (missing.length > 3) messages.push(`…and ${missing.length - 3} more that are missing.`);
    extra.slice(0, 3).forEach((a) => messages.push(`Shouldn't have made: ${descA(a)}`));
    if (extra.length > 3) messages.push(`…and ${extra.length - 3} more that shouldn't be there.`);
  }
  return { messages, expected, actual };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function checkWorld(test: TestCase, world: World): Compared {
  const x = test.expect;
  const parts = [
    compare("slack", "Slack message", x.slack ?? [], world.slack, slackMatches, describeSlackExpect, describeSlack),
    compare("email", "email", x.emails ?? [], world.emails, emailMatches, describeEmailExpect, describeEmail),
    compare("row", "sheet row", x.rows ?? [], world.rows, rowMatches, describeRowExpect, describeRow),
  ];
  return {
    messages: parts.flatMap((p) => p.messages),
    expected: parts.flatMap((p) => p.expected),
    actual: parts.flatMap((p) => p.actual),
  };
}

export function gradeTest(wf: Workflow, level: Level, test: TestCase): TestResult {
  const { world, trace, error } = runTest(wf, level, test);
  const checked = checkWorld(test, world);
  let problem = error;
  const expectsSomething = checked.expected.length > 0;
  if (!error && trace.runs === 0 && expectsSomething) {
    const trigger = wf.nodes.find((n) => n.type.startsWith("trigger."));
    problem =
      trigger?.type === `trigger.${level.trigger}` && level.trigger === "schedule"
        ? "Your schedule never fired during this test. Check how often and when it runs."
        : "Your trigger never fired, so nothing happened. Is it the right kind of trigger?";
  }
  const messages = problem ? [problem] : checked.messages;
  const passed = messages.length === 0;
  if (!passed && test.failHint) messages.push(test.failHint);
  return {
    id: test.id,
    label: test.label,
    hidden: test.hidden,
    passed,
    messages,
    expected: checked.expected,
    actual: checked.actual,
    problem,
    hint: passed ? undefined : test.failHint,
    world,
    trace,
  };
}

export function gradeLevel(wf: Workflow, level: Level): GradeResult {
  const issues = validate(wf, level);
  if (issues.length) return { issues, tests: [], passed: false };
  const tests = level.tests.map((t) => gradeTest(wf, level, t));
  return { issues, tests, passed: tests.every((t) => t.passed) };
}
