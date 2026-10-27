"use client";

import { Plus, Trash2, X } from "lucide-react";
import type { ExtractType } from "@/engine/ai";
import { OPS } from "@/engine/conditions";
import { NODES, type ExtractConfig, type FilterConfig, type SwitchConfig } from "@/engine/nodes";
import { WEEKDAYS } from "@/engine/schedule";
import type { Condition, Config, FieldInfo, Level, WfNode } from "@/engine/types";
import { CATEGORY_COLOR, NODE_ICON } from "../canvas/icons";
import { FieldSelect, Label, Section, Select, TemplateInput, inputCls } from "./fields";

interface Props {
  node: WfNode;
  level: Level;
  fields: FieldInfo[];
  issue?: string;
  onChange: (patch: Config) => void;
  onDelete: () => void;
  onClose: () => void;
}

const str = (c: Config, k: string) => (typeof c[k] === "string" ? (c[k] as string) : "");

export function ConfigPanel({ node, level, fields, issue, onChange, onDelete, onClose }: Props) {
  const def = NODES[node.type];
  const Icon = NODE_ICON[node.type];
  const color = CATEGORY_COLOR[def.category];
  const c = node.config;

  return (
    <aside className="flex h-full w-[360px] shrink-0 flex-col border-l border-line bg-cream">
      <div className="flex items-start gap-3 border-b border-line px-5 py-4">
        <span
          className="grid size-10 shrink-0 place-items-center rounded-xl"
          style={{ background: `color-mix(in srgb, ${color} 16%, white)`, color: `color-mix(in srgb, ${color} 75%, black)` }}
        >
          <Icon size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-display text-xl leading-tight">{def.label}</div>
          <div className="mt-0.5 text-[12.5px] text-ink-muted">{def.description}</div>
        </div>
        <button onClick={onClose} className="rounded p-1 text-ink-muted hover:bg-line/60 hover:text-ink" aria-label="Close panel">
          <X size={17} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {issue && <div className="mb-4 rounded-lg border border-fail/25 bg-fail/[0.06] px-3 py-2 text-[12.5px] text-fail">{issue}</div>}
        <Editor node={node} level={level} fields={fields} c={c} onChange={onChange} />
      </div>

      <div className="border-t border-line px-5 py-3">
        <button onClick={onDelete} className="flex items-center gap-2 text-[13px] text-ink-muted hover:text-fail">
          <Trash2 size={15} /> Delete step
        </button>
      </div>
    </aside>
  );
}

function Editor({
  node,
  level,
  fields,
  c,
  onChange,
}: {
  node: WfNode;
  level: Level;
  fields: FieldInfo[];
  c: Config;
  onChange: (patch: Config) => void;
}) {
  switch (node.type) {
    case "trigger.form": {
      const sample = level.tests.find((t) => !t.hidden)?.input.events?.[0];
      return (
        <>
          <Section label="Form">
            <div className="rounded-lg border border-line bg-surface px-3 py-2 text-sm">{level.form?.title ?? "Form"}</div>
          </Section>
          <Section label="Fields this trigger gives you">
            <FieldList names={level.form?.fields ?? []} sample={sample} />
          </Section>
        </>
      );
    }
    case "trigger.email": {
      const sample = level.trigger === "email" ? level.tests.find((t) => !t.hidden)?.input.events?.[0] : undefined;
      return (
        <Section label="Fields this trigger gives you">
          <FieldList names={["from", "from_name", "subject", "body"]} sample={sample} />
        </Section>
      );
    }
    case "trigger.schedule": {
      const freq = str(c, "frequency") || "day";
      return (
        <>
          <Section label="Runs">
            <Select
              value={freq}
              onChange={(v) => onChange({ frequency: v })}
              options={[
                { value: "hour", label: "Every hour" },
                { value: "day", label: "Every day" },
                { value: "week", label: "Every week" },
              ]}
            />
          </Section>
          {freq === "week" && (
            <Section label="On">
              <Select
                value={Number(c.weekday ?? 1)}
                onChange={(v) => onChange({ weekday: v })}
                options={WEEKDAYS.map((d, i) => ({ value: i, label: d }))}
              />
            </Section>
          )}
          <Section label={freq === "hour" ? "At minute" : "At"} hint="24-hour time">
            <input type="time" value={str(c, "time")} onChange={(e) => onChange({ time: e.target.value })} className={inputCls} />
          </Section>
          <Section label="Fields this trigger gives you">
            <FieldList names={["fired_at", "weekday", "time"]} />
          </Section>
        </>
      );
    }
    case "data.readSheet":
      return (
        <>
          <Section label="Sheet">
            <Select
              value={str(c, "sheet")}
              placeholder="Pick a sheet…"
              onChange={(v) => onChange({ sheet: v })}
              options={Object.keys(level.sheets).map((s) => ({ value: s, label: s }))}
            />
          </Section>
          {level.sheets[str(c, "sheet")] && (
            <Section label="Columns">
              <FieldList names={level.sheets[str(c, "sheet")].columns} />
            </Section>
          )}
          <Note>Outputs one item with a list called rows. Use For each to go through the rows one by one.</Note>
        </>
      );
    case "data.forEach":
      return (
        <>
          <Section label="List to loop over">
            <FieldSelect value={str(c, "field")} onChange={(v) => onChange({ field: v })} fields={fields} kinds={["rows", "list"]} />
          </Section>
          <Note>Every step after this runs once per entry. Each row&apos;s columns become fields.</Note>
        </>
      );
    case "data.combine":
      return (
        <>
          <Section label="Line template" hint="optional">
            <TemplateInput
              value={str(c, "lineTemplate")}
              onChange={(v) => onChange({ lineTemplate: v })}
              fields={fields}
              placeholder="{{item}}: {{stock}} left"
            />
          </Section>
          <Section label="Add up a field" hint="optional">
            <FieldSelect value={str(c, "sumField")} onChange={(v) => onChange({ sumField: v })} fields={fields} placeholder="Don't add anything up" />
          </Section>
          <Note>
            Many items in, one item out with <Code>count</Code>, <Code>lines</Code> (one line per item)
            {str(c, "sumField") && (
              <>
                {" "}
                and <Code>sum_{str(c, "sumField")}</Code>
              </>
            )}
            . If nothing arrives, nothing comes out.
          </Note>
        </>
      );
    case "logic.filter":
    case "logic.ifElse":
      return <ConditionsEditor cfg={c as unknown as FilterConfig} fields={fields} onChange={onChange} />;
    case "logic.switch": {
      const sw = c as unknown as SwitchConfig;
      const rules = sw.rules ?? [];
      return (
        <>
          <Section label="Route by">
            <FieldSelect value={sw.field} onChange={(v) => onChange({ field: v })} fields={fields} />
          </Section>
          <Section label="Routes" hint="one output per value">
            <div className="space-y-2">
              {rules.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-14 shrink-0 text-[12px] text-ink-muted">equals</span>
                  <input
                    value={r}
                    onChange={(e) => onChange({ rules: rules.map((x, j) => (j === i ? e.target.value : x)) })}
                    placeholder={`value ${i + 1}`}
                    className={`${inputCls} font-mono text-[12.5px]`}
                  />
                  <IconBtn onClick={() => onChange({ rules: rules.filter((_, j) => j !== i) })} disabled={rules.length <= 1} />
                </div>
              ))}
            </div>
            {rules.length < 5 && <AddBtn onClick={() => onChange({ rules: [...rules, ""] })}>Add route</AddBtn>}
          </Section>
          <Note>Anything that matches no route goes out the fallback output.</Note>
        </>
      );
    }
    case "ai.classify":
      return (
        <>
          <Section label="Text to classify">
            <FieldSelect value={str(c, "field")} onChange={(v) => onChange({ field: v })} fields={fields} kinds={["text", "list"]} />
          </Section>
          <Section label="Labels" hint="comma separated">
            <input
              value={str(c, "labels")}
              onChange={(e) => onChange({ labels: e.target.value })}
              placeholder="e.g. urgent, not urgent"
              className={`${inputCls} font-mono text-[12.5px]`}
            />
          </Section>
          <Section label="Save the answer as">
            <input value={str(c, "output")} onChange={(e) => onChange({ output: e.target.value })} className={`${inputCls} font-mono text-[12.5px]`} />
          </Section>
          <Note>The AI picks exactly one of your labels. If none fit, it answers “unknown”.</Note>
        </>
      );
    case "ai.extract": {
      const e = c as unknown as ExtractConfig;
      const list = e.fields ?? [];
      return (
        <>
          <Section label="Text to read">
            <FieldSelect value={e.field} onChange={(v) => onChange({ field: v })} fields={fields} kinds={["text"]} />
          </Section>
          <Section label="Facts to pull out">
            <div className="space-y-2">
              {list.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={f.name}
                    onChange={(ev) => onChange({ fields: list.map((x, j) => (j === i ? { ...x, name: ev.target.value } : x)) })}
                    placeholder="field name"
                    className={`${inputCls} font-mono text-[12.5px]`}
                  />
                  <select
                    value={f.type}
                    onChange={(ev) => onChange({ fields: list.map((x, j) => (j === i ? { ...x, type: ev.target.value as ExtractType } : x)) })}
                    className={`${inputCls} w-[96px] shrink-0`}
                  >
                    <option value="text">text</option>
                    <option value="number">number</option>
                    <option value="list">list</option>
                  </select>
                  <IconBtn onClick={() => onChange({ fields: list.filter((_, j) => j !== i) })} disabled={list.length <= 1} />
                </div>
              ))}
            </div>
            <AddBtn onClick={() => onChange({ fields: [...list, { name: "", type: "text" }] })}>Add fact</AddBtn>
          </Section>
          <Note>Each fact becomes a new field. Pick the type you need: you can only do math on numbers.</Note>
        </>
      );
    }
    case "ai.write":
      return (
        <>
          <Section label="Instructions">
            <TemplateInput
              multiline
              rows={5}
              value={str(c, "instructions")}
              onChange={(v) => onChange({ instructions: v })}
              fields={fields}
              placeholder="Write a friendly note to {{name}} about…"
            />
          </Section>
          <Section label="Save the text as">
            <input value={str(c, "output")} onChange={(ev) => onChange({ output: ev.target.value })} className={`${inputCls} font-mono text-[12.5px]`} />
          </Section>
          <Note>The AI only knows what you put in the instructions. Click fields to give it the facts it needs.</Note>
        </>
      );
    case "action.email":
      return (
        <>
          <Section label="To">
            <TemplateInput value={str(c, "to")} onChange={(v) => onChange({ to: v })} fields={fields} placeholder="name@example.com" />
          </Section>
          <Section label="Subject">
            <TemplateInput value={str(c, "subject")} onChange={(v) => onChange({ subject: v })} fields={fields} />
          </Section>
          <Section label="Body">
            <TemplateInput multiline value={str(c, "body")} onChange={(v) => onChange({ body: v })} fields={fields} />
          </Section>
        </>
      );
    case "action.slack":
      return (
        <>
          <Section label="Channel">
            <Select
              value={str(c, "channel")}
              placeholder="Pick a channel…"
              onChange={(v) => onChange({ channel: v })}
              options={level.channels.map((ch) => ({ value: ch, label: ch }))}
            />
          </Section>
          <Section label="Message">
            <TemplateInput multiline rows={3} value={str(c, "message")} onChange={(v) => onChange({ message: v })} fields={fields} />
          </Section>
        </>
      );
    case "action.sheetRow": {
      const sheet = level.sheets[str(c, "sheet")];
      const values = (c.values ?? {}) as Record<string, string>;
      return (
        <>
          <Section label="Sheet">
            <Select
              value={str(c, "sheet")}
              placeholder="Pick a sheet…"
              onChange={(v) => onChange({ sheet: v, values: {} })}
              options={Object.keys(level.sheets).map((s) => ({ value: s, label: s }))}
            />
          </Section>
          {sheet?.columns.map((col) => (
            <Section key={col} label={col}>
              <TemplateInput value={values[col] ?? ""} onChange={(v) => onChange({ values: { ...values, [col]: v } })} fields={fields} />
            </Section>
          ))}
        </>
      );
    }
  }
}

function ConditionsEditor({ cfg, fields, onChange }: { cfg: FilterConfig; fields: FieldInfo[]; onChange: (p: Config) => void }) {
  const conds = cfg.conditions ?? [];
  const set = (i: number, patch: Partial<Condition>) => onChange({ conditions: conds.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  return (
    <>
      {conds.length > 1 && (
        <Section label="Pass when">
          <Select
            value={cfg.match ?? "all"}
            onChange={(v) => onChange({ match: v })}
            options={[
              { value: "all", label: "ALL conditions are true" },
              { value: "any", label: "ANY condition is true" },
            ]}
          />
        </Section>
      )}
      <Label>Conditions</Label>
      <div className="space-y-3">
        {conds.map((c, i) => {
          const needsValue = OPS.find((o) => o.op === c.op)?.needsValue ?? true;
          return (
            <div key={i} className="rounded-xl border border-line bg-surface p-3">
              <div className="flex items-center gap-2">
                <FieldSelect value={c.field} onChange={(v) => set(i, { field: v })} fields={fields} kinds={["text", "number", "list"]} />
                <IconBtn onClick={() => onChange({ conditions: conds.filter((_, j) => j !== i) })} disabled={conds.length <= 1} />
              </div>
              <select value={c.op} onChange={(e) => set(i, { op: e.target.value as Condition["op"] })} className={`${inputCls} mt-2`}>
                {OPS.map((o) => (
                  <option key={o.op} value={o.op}>
                    {o.label}
                  </option>
                ))}
              </select>
              {needsValue && (
                <div className="mt-2">
                  <TemplateInput value={c.value} onChange={(v) => set(i, { value: v })} fields={fields} placeholder="value" />
                </div>
              )}
              {i < conds.length - 1 && (
                <div className="-mb-6 mt-3 text-center text-[11px] font-medium tracking-wider text-ink-muted">
                  {cfg.match === "any" ? "OR" : "AND"}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <AddBtn onClick={() => onChange({ conditions: [...conds, { field: "", op: "equals", value: "" }] })}>Add condition</AddBtn>
    </>
  );
}

function FieldList({ names, sample }: { names: string[]; sample?: Record<string, unknown> }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      {names.map((n) => (
        <div key={n} className="flex gap-3 border-b border-line px-3 py-1.5 text-[12.5px] last:border-0">
          <span className="w-24 shrink-0 font-mono text-crimson">{n}</span>
          {sample && <span className="truncate text-ink-muted">{String(sample[n] ?? "")}</span>}
        </div>
      ))}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">{children}</p>;
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-crimson/[0.07] px-1 font-mono text-[11.5px] text-crimson">{children}</code>;
}

function IconBtn({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="shrink-0 rounded p-1.5 text-ink-muted hover:bg-line/60 hover:text-fail disabled:opacity-30 disabled:hover:bg-transparent"
      aria-label="Remove"
    >
      <X size={15} />
    </button>
  );
}

function AddBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="mt-2 flex items-center gap-1.5 text-[12.5px] font-medium text-crimson hover:text-crimson-dark">
      <Plus size={14} /> {children}
    </button>
  );
}
