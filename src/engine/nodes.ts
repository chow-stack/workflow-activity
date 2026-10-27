// Node catalog: config defaults, validation, static field propagation, one-line summaries and run logic.
import * as ai from "./ai";
import { evalConditions, opLabel } from "./conditions";
import { describeSchedule, type ScheduleConfig } from "./schedule";
import { render } from "./template";
import type {
  Category,
  Condition,
  Config,
  FieldInfo,
  Item,
  Level,
  NodeType,
  Row,
  Scalar,
  World,
} from "./types";

export interface RunCtx {
  level: Level;
  world: World;
  warn: (msg: string) => void;
}

export interface OutputHandle {
  id: string;
  label?: string;
}

export interface NodeDef {
  type: NodeType;
  category: Category;
  label: string;
  description: string;
  defaults: () => Config;
  outputs: (config: Config) => OutputHandle[];
  validate: (config: Config, level: Level) => string | null;
  outputFields: (config: Config, input: FieldInfo[], level: Level) => FieldInfo[];
  summary: (config: Config) => string;
  run?: (items: Item[], config: Config, ctx: RunCtx) => Record<string, Item[]>;
}

// ---- config accessors ----
export interface FilterConfig {
  match: "all" | "any";
  conditions: Condition[];
}
export interface SwitchConfig {
  field: string;
  rules: string[];
}
export interface ExtractConfig {
  field: string;
  fields: { name: string; type: ai.ExtractType }[];
}

const s = (c: Config, k: string) => (typeof c[k] === "string" ? (c[k] as string) : "");
const OUT: OutputHandle[] = [{ id: "out" }];
const passthrough = (_: Config, input: FieldInfo[]) => input;

function addFields(input: FieldInfo[], extra: FieldInfo[]): FieldInfo[] {
  const names = new Set(extra.map((f) => f.name));
  return [...input.filter((f) => !names.has(f.name)), ...extra];
}

function renderAll(t: string, item: Item, ctx: RunCtx): string {
  const missing = new Set<string>();
  const out = render(t, item, missing);
  missing.forEach((m) => ctx.warn(`{{${m}}} doesn't exist at this step, so it was left blank.`));
  return out;
}

function conditionSummary(cfg: FilterConfig): string {
  const parts = (cfg.conditions ?? [])
    .filter((c) => c.field)
    .map((c) => `${c.field} ${opLabel(c.op)}${c.op === "empty" || c.op === "notEmpty" ? "" : ` ${c.value}`}`);
  if (parts.length === 0) return "No conditions yet";
  return parts.join(cfg.match === "any" ? " OR " : " AND ");
}

function validateConditions(cfg: FilterConfig): string | null {
  const conds = cfg.conditions ?? [];
  if (conds.length === 0) return "Add at least one condition.";
  for (const c of conds) {
    if (!c.field) return "Pick a field for every condition.";
    if (c.op !== "empty" && c.op !== "notEmpty" && !String(c.value ?? "").trim())
      return "Every condition needs a value.";
  }
  return null;
}

const asFilter = (c: Config) => c as unknown as FilterConfig;
const asSwitch = (c: Config) => c as unknown as SwitchConfig;
const asExtract = (c: Config) => c as unknown as ExtractConfig;
const asSchedule = (c: Config) => c as unknown as ScheduleConfig;

export const NODES: Record<NodeType, NodeDef> = {
  // ---------------- Triggers ----------------
  "trigger.form": {
    type: "trigger.form",
    category: "trigger",
    label: "Form submitted",
    description: "Runs every time someone submits the form.",
    defaults: () => ({}),
    outputs: () => OUT,
    validate: () => null,
    outputFields: (_c, _i, level) => (level.form?.fields ?? []).map((name) => ({ name, kind: "text" })),
    summary: () => "On each submission",
  },
  "trigger.email": {
    type: "trigger.email",
    category: "trigger",
    label: "New email",
    description: "Runs every time an email arrives in the inbox.",
    defaults: () => ({}),
    outputs: () => OUT,
    validate: () => null,
    outputFields: () => [
      { name: "from", kind: "text" },
      { name: "from_name", kind: "text" },
      { name: "subject", kind: "text" },
      { name: "body", kind: "text" },
    ],
    summary: () => "On each new email",
  },
  "trigger.schedule": {
    type: "trigger.schedule",
    category: "trigger",
    label: "Schedule",
    description: "Runs on a timer: every hour, day or week.",
    defaults: () => ({ frequency: "day", time: "09:00", weekday: 1 }),
    outputs: () => OUT,
    validate: (c) => (/^\d{1,2}:\d{2}$/.test(s(c, "time")) ? null : "Set a time like 08:00."),
    outputFields: () => [
      { name: "fired_at", kind: "text" },
      { name: "weekday", kind: "text" },
      { name: "time", kind: "text" },
    ],
    summary: (c) => describeSchedule(asSchedule(c)),
  },

  // ---------------- Data ----------------
  "data.readSheet": {
    type: "data.readSheet",
    category: "data",
    label: "Read sheet",
    description: "Loads every row of a sheet into a list called rows.",
    defaults: () => ({ sheet: "" }),
    outputs: () => OUT,
    validate: (c, level) => (s(c, "sheet") in level.sheets ? null : "Pick a sheet."),
    outputFields: (c, input, level) =>
      addFields(input, [
        { name: "rows", kind: "rows", columns: level.sheets[s(c, "sheet")]?.columns ?? [] },
        { name: "row_count", kind: "number" },
      ]),
    summary: (c) => (s(c, "sheet") ? `All rows from ${s(c, "sheet")}` : "No sheet picked"),
    run: (items, c, ctx) => {
      const rows = ctx.world.sheets[s(c, "sheet")] ?? [];
      return { out: items.map((it) => ({ ...it, rows: rows.map((r) => ({ ...r })), row_count: rows.length })) };
    },
  },
  "data.forEach": {
    type: "data.forEach",
    category: "data",
    label: "For each",
    description: "Splits a list so every next step runs once per entry.",
    defaults: () => ({ field: "" }),
    outputs: () => OUT,
    validate: (c) => (s(c, "field") ? null : "Pick the list to loop over."),
    outputFields: (c, input) => {
      const f = input.find((x) => x.name === s(c, "field"));
      const rest = input.filter((x) => x.name !== s(c, "field") && x.name !== "row_count");
      if (f?.kind === "rows") return addFields(rest, (f.columns ?? []).map((name) => ({ name, kind: "text" })));
      return addFields(rest, [{ name: "item", kind: "text" }]);
    },
    summary: (c) => (s(c, "field") ? `Once per entry in ${s(c, "field")}` : "No list picked"),
    run: (items, c, ctx) => {
      const field = s(c, "field");
      const out: Item[] = [];
      for (const it of items) {
        const list = it[field];
        if (!Array.isArray(list)) {
          ctx.warn(`"${field}" isn't a list, so For each had nothing to loop over.`);
          continue;
        }
        const rest: Item = { ...it };
        delete rest[field];
        delete rest.row_count;
        for (const el of list) {
          if (el !== null && typeof el === "object") out.push({ ...rest, ...(el as Row) });
          else out.push({ ...rest, item: el as Scalar });
        }
      }
      return { out };
    },
  },
  "data.combine": {
    type: "data.combine",
    category: "data",
    label: "Combine",
    description: "Bundles many items into one: a count, a total and a list of lines.",
    defaults: () => ({ lineTemplate: "", sumField: "" }),
    outputs: () => OUT,
    validate: () => null,
    outputFields: (c) => {
      const f: FieldInfo[] = [
        { name: "count", kind: "number" },
        { name: "lines", kind: "text" },
      ];
      if (s(c, "sumField")) f.push({ name: `sum_${s(c, "sumField")}`, kind: "number" });
      return f;
    },
    summary: (c) =>
      ["count", s(c, "lineTemplate") ? "lines" : "", s(c, "sumField") ? `sum of ${s(c, "sumField")}` : ""]
        .filter(Boolean)
        .join(" · "),
    run: (items, c, ctx) => {
      if (items.length === 0) return { out: [] };
      const out: Item = {
        count: items.length,
        lines: items.map((it) => renderAll(s(c, "lineTemplate"), it, ctx)).join("\n"),
      };
      const sf = s(c, "sumField");
      if (sf) {
        let total = 0;
        for (const it of items) {
          const n = Number(String(it[sf] ?? "").replace(/[$,]/g, ""));
          if (Number.isFinite(n)) total += n;
        }
        out[`sum_${sf}`] = Math.round(total * 100) / 100;
      }
      return { out: [out] };
    },
  },

  // ---------------- Logic ----------------
  "logic.filter": {
    type: "logic.filter",
    category: "logic",
    label: "Filter",
    description: "Only lets items through when the conditions are true.",
    defaults: () => ({ match: "all", conditions: [{ field: "", op: "equals", value: "" }] }),
    outputs: () => [{ id: "kept", label: "kept" }],
    validate: (c) => validateConditions(asFilter(c)),
    outputFields: passthrough,
    summary: (c) => conditionSummary(asFilter(c)),
    run: (items, c) => {
      const f = asFilter(c);
      return { kept: items.filter((it) => evalConditions(f.conditions, f.match, it)) };
    },
  },
  "logic.ifElse": {
    type: "logic.ifElse",
    category: "logic",
    label: "If / Else",
    description: "Sends each item down the true or false path.",
    defaults: () => ({ match: "all", conditions: [{ field: "", op: "equals", value: "" }] }),
    outputs: () => [
      { id: "true", label: "true" },
      { id: "false", label: "false" },
    ],
    validate: (c) => validateConditions(asFilter(c)),
    outputFields: passthrough,
    summary: (c) => conditionSummary(asFilter(c)),
    run: (items, c) => {
      const f = asFilter(c);
      const t: Item[] = [];
      const fl: Item[] = [];
      for (const it of items) (evalConditions(f.conditions, f.match, it) ? t : fl).push(it);
      return { true: t, false: fl };
    },
  },
  "logic.switch": {
    type: "logic.switch",
    category: "logic",
    label: "Switch",
    description: "Routes each item by the value of one field.",
    defaults: () => ({ field: "", rules: ["", ""] }),
    outputs: (c) => [
      ...(asSwitch(c).rules ?? []).map((r, i) => ({ id: `r${i}`, label: r || `rule ${i + 1}` })),
      { id: "fallback", label: "fallback" },
    ],
    validate: (c) => {
      const sw = asSwitch(c);
      if (!sw.field) return "Pick the field to switch on.";
      if (!(sw.rules ?? []).some((r) => r.trim())) return "Add at least one value to route.";
      return null;
    },
    outputFields: passthrough,
    summary: (c) => {
      const sw = asSwitch(c);
      return sw.field ? `Route by ${sw.field}` : "No field picked";
    },
    run: (items, c) => {
      const sw = asSwitch(c);
      const out: Record<string, Item[]> = { fallback: [] };
      sw.rules.forEach((_, i) => (out[`r${i}`] = []));
      for (const it of items) {
        const v = String(it[sw.field] ?? "").trim().toLowerCase();
        const idx = sw.rules.findIndex((r) => r.trim() && r.trim().toLowerCase() === v);
        out[idx >= 0 ? `r${idx}` : "fallback"].push(it);
      }
      return out;
    },
  },

  // ---------------- AI (simulated) ----------------
  "ai.classify": {
    type: "ai.classify",
    category: "ai",
    label: "AI Classify",
    description: "Reads some text and picks one of your labels.",
    defaults: () => ({ field: "", labels: "", output: "label" }),
    outputs: () => OUT,
    validate: (c) => {
      if (!s(c, "field")) return "Pick the text to classify.";
      if (!s(c, "labels").trim()) return "List the labels the AI can choose from.";
      if (!s(c, "output").trim()) return "Name the output field.";
      return null;
    },
    outputFields: (c, input) => addFields(input, [{ name: s(c, "output") || "label", kind: "text" }]),
    summary: (c) => (s(c, "labels") ? `→ ${s(c, "labels")}` : "No labels yet"),
    run: (items, c, ctx) => ({
      out: items.map((it) => ({
        ...it,
        [s(c, "output") || "label"]: ai.classify(ctx.level.ai, it[s(c, "field")], s(c, "labels")),
      })),
    }),
  },
  "ai.extract": {
    type: "ai.extract",
    category: "ai",
    label: "AI Extract",
    description: "Pulls specific facts out of messy text.",
    defaults: () => ({ field: "", fields: [{ name: "", type: "text" }] }),
    outputs: () => OUT,
    validate: (c) => {
      const e = asExtract(c);
      if (!e.field) return "Pick the text to read.";
      if (!(e.fields ?? []).some((f) => f.name.trim())) return "Add at least one field to extract.";
      return null;
    },
    outputFields: (c, input) =>
      addFields(
        input,
        (asExtract(c).fields ?? [])
          .filter((f) => f.name.trim())
          .map((f) => ({ name: f.name.trim(), kind: f.type === "number" ? "number" : f.type === "list" ? "list" : "text" })),
      ),
    summary: (c) => {
      const names = (asExtract(c).fields ?? []).map((f) => f.name.trim()).filter(Boolean);
      return names.length ? `→ ${names.join(", ")}` : "No fields yet";
    },
    run: (items, c, ctx) => {
      const e = asExtract(c);
      return { out: items.map((it) => ({ ...it, ...ai.extract(ctx.level.ai, it[e.field], e.fields ?? []) })) };
    },
  },
  "ai.write": {
    type: "ai.write",
    category: "ai",
    label: "AI Write",
    description: "Writes text from your instructions. It only knows what you give it.",
    defaults: () => ({ instructions: "", output: "ai_text" }),
    outputs: () => OUT,
    validate: (c) => {
      if (!s(c, "instructions").trim()) return "Write instructions for the AI.";
      if (!s(c, "output").trim()) return "Name the output field.";
      return null;
    },
    outputFields: (c, input) => addFields(input, [{ name: s(c, "output") || "ai_text", kind: "text" }]),
    summary: (c) => (s(c, "instructions") ? `“${s(c, "instructions").slice(0, 38)}…”` : "No instructions yet"),
    run: (items, c, ctx) => ({
      out: items.map((it) => ({
        ...it,
        [s(c, "output") || "ai_text"]: ai.write(ctx.level.ai, s(c, "instructions"), it),
      })),
    }),
  },

  // ---------------- Actions ----------------
  "action.email": {
    type: "action.email",
    category: "action",
    label: "Send email",
    description: "Sends an email.",
    defaults: () => ({ to: "", subject: "", body: "" }),
    outputs: () => OUT,
    validate: (c) => {
      if (!s(c, "to").trim()) return "Who is the email to?";
      if (!s(c, "body").trim()) return "Write the email body.";
      return null;
    },
    outputFields: passthrough,
    summary: (c) => (s(c, "to") ? `To ${s(c, "to")}` : "No recipient yet"),
    run: (items, c, ctx) => {
      for (const it of items) {
        ctx.world.emails.push({
          to: renderAll(s(c, "to"), it, ctx).trim(),
          subject: renderAll(s(c, "subject"), it, ctx),
          body: renderAll(s(c, "body"), it, ctx),
          ...(typeof it.fired_at === "string" ? { at: it.fired_at } : {}),
        });
      }
      return { out: items };
    },
  },
  "action.slack": {
    type: "action.slack",
    category: "action",
    label: "Slack message",
    description: "Posts a message to a Slack channel.",
    defaults: () => ({ channel: "", message: "" }),
    outputs: () => OUT,
    validate: (c, level) => {
      if (!level.channels.includes(s(c, "channel"))) return "Pick a channel.";
      if (!s(c, "message").trim()) return "Write the message.";
      return null;
    },
    outputFields: passthrough,
    summary: (c) => (s(c, "channel") ? `Post in ${s(c, "channel")}` : "No channel picked"),
    run: (items, c, ctx) => {
      for (const it of items) {
        ctx.world.slack.push({
          channel: s(c, "channel"),
          text: renderAll(s(c, "message"), it, ctx),
          ...(typeof it.fired_at === "string" ? { at: it.fired_at } : {}),
        });
      }
      return { out: items };
    },
  },
  "action.sheetRow": {
    type: "action.sheetRow",
    category: "action",
    label: "Add sheet row",
    description: "Adds a row to a spreadsheet.",
    defaults: () => ({ sheet: "", values: {} }),
    outputs: () => OUT,
    validate: (c, level) => {
      const sheet = level.sheets[s(c, "sheet")];
      if (!sheet) return "Pick a sheet.";
      const values = (c.values ?? {}) as Record<string, string>;
      if (!sheet.columns.some((col) => values[col]?.trim())) return "Fill in at least one column.";
      return null;
    },
    outputFields: passthrough,
    summary: (c) => (s(c, "sheet") ? `Add to ${s(c, "sheet")}` : "No sheet picked"),
    run: (items, c, ctx) => {
      const sheet = s(c, "sheet");
      const cols = ctx.level.sheets[sheet]?.columns ?? [];
      const values = (c.values ?? {}) as Record<string, string>;
      for (const it of items) {
        const row: Row = {};
        for (const col of cols) row[col] = renderAll(values[col] ?? "", it, ctx);
        ctx.world.rows.push({ sheet, row });
      }
      return { out: items };
    },
  },
};

export const isTrigger = (t: NodeType) => NODES[t].category === "trigger";

export const CATEGORY_ORDER: Category[] = ["trigger", "data", "logic", "ai", "action"];
export const CATEGORY_LABEL: Record<Category, string> = {
  trigger: "Triggers",
  data: "Data",
  logic: "Logic",
  ai: "AI",
  action: "Actions",
};
