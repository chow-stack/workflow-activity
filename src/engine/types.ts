// Core data model for the workflow engine. No React imports anywhere in src/engine.

export type Scalar = string | number | boolean | null;
export type Row = Record<string, Scalar>;
export type Value = Scalar | Scalar[] | Row[];
export type Item = Record<string, Value>;

export type NodeType =
  | "trigger.form"
  | "trigger.email"
  | "trigger.schedule"
  | "data.readSheet"
  | "data.forEach"
  | "data.combine"
  | "logic.filter"
  | "logic.ifElse"
  | "logic.switch"
  | "ai.classify"
  | "ai.extract"
  | "ai.write"
  | "action.email"
  | "action.slack"
  | "action.sheetRow";

export type Category = "trigger" | "data" | "logic" | "ai" | "action";

export type Config = Record<string, unknown>;

export interface WfNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  config: Config;
}

export interface WfEdge {
  id: string;
  source: string;
  sourceHandle?: string | null;
  target: string;
}

export interface Workflow {
  nodes: WfNode[];
  edges: WfEdge[];
}

// ---- Conditions ----

export type Op =
  | "equals"
  | "notEquals"
  | "contains"
  | "notContains"
  | "startsWith"
  | "endsWith"
  | "endsWithAny"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "empty"
  | "notEmpty";

export interface Condition {
  field: string;
  op: Op;
  value: string; // literal or template, e.g. "{{reorder_level}}"
}

// ---- Fields (static propagation) ----

export type FieldKind = "text" | "number" | "list" | "rows";

export interface FieldInfo {
  name: string;
  kind: FieldKind;
  columns?: string[]; // for kind "rows"
}

// ---- World (what the workflow produced) ----

export interface SlackMsg {
  channel: string;
  text: string;
  at?: string;
}

export interface Email {
  to: string;
  subject: string;
  body: string;
  at?: string;
}

export interface AppendedRow {
  sheet: string;
  row: Row;
}

export interface World {
  sheets: Record<string, Row[]>; // sheet contents available to Read sheet
  slack: SlackMsg[];
  emails: Email[];
  rows: AppendedRow[];
}

// ---- Levels ----

export type TriggerKind = "form" | "email" | "schedule";
export type Tier = "demo" | "easy" | "medium" | "hard" | "expert";

export interface SlackExpect {
  channel: string;
  includes?: string[];
  includesNumber?: number[];
  at?: string;
}

export interface EmailExpect {
  to: string;
  subjectIncludes?: string[];
  bodyIncludes?: string[];
  bodyExcludes?: string[];
  includesNumber?: number[];
}

export interface RowExpect {
  sheet: string;
  match: Row;
}

export interface Expect {
  slack?: SlackExpect[];
  emails?: EmailExpect[];
  rows?: RowExpect[];
}

export interface TestInput {
  events?: Item[]; // form submissions or emails, one workflow run each
  window?: { startWeekday: number; days: number }; // schedule simulation, 0 = Sunday
  sheets?: Record<string, Row[]>;
}

export interface TestCase {
  id: string;
  label: string;
  hidden: boolean;
  input: TestInput;
  expect: Expect;
  failHint?: string;
}

export interface WriteFixture {
  template: string; // "Hi {client}, ..."
  format?: Record<string, string>; // slot → "${v}" wrapper used when the slot is filled
  fallbacks: Record<string, string>; // slot → vague phrase used when the AI wasn't told the field
}

export interface AiFixtures {
  classify?: Record<string, string>;
  extract?: Record<string, Record<string, Scalar | Scalar[]>>;
  write?: WriteFixture;
}

export interface Trap {
  name: string;
  workflow: Workflow;
  shouldFail: string[]; // test ids that must fail
}

export interface Level {
  id: number;
  slug: string;
  title: string;
  tier: Tier;
  points: number;
  skill: string; // the one new idea this level introduces, e.g. "Filters"
  skillHow: string; // one or two sentences on how that idea works
  task: string; // what to build, one plain sentence
  goals: string[]; // checklist the tests check
  trigger: TriggerKind;
  palette: NodeType[];
  form?: { title: string; fields: string[] };
  channels: string[];
  sheets: Record<string, { columns: string[] }>;
  tests: TestCase[];
  ai: AiFixtures;
  hints: string[];
  reference: Workflow;
  traps: Trap[];
}
