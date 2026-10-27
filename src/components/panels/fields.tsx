"use client";

import { useRef, type ReactNode } from "react";
import type { FieldInfo } from "@/engine/types";

export const inputCls =
  "w-full rounded border border-line-strong bg-paper px-3 py-2 text-[14px] text-ink outline-none transition placeholder:text-faint focus:border-ink";

export function Label({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-2">
      <span className="text-[13px] font-semibold text-ink">{children}</span>
      {hint && <span className="text-[12px] text-muted">{hint}</span>}
    </div>
  );
}

export function Section({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="mb-5">
      <Label hint={hint}>{label}</Label>
      {children}
    </div>
  );
}

export function Chip({ field, onClick }: { field: FieldInfo; onClick: () => void }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={`Insert {{${field.name}}}`}
      className="inline-flex items-center rounded bg-crimson-soft px-1.5 py-0.5 font-mono text-[11.5px] text-crimson transition hover:bg-crimson hover:text-paper"
    >
      {field.name}
    </button>
  );
}

/** Text input that accepts {{field}} tokens; clicking a chip inserts at the cursor. */
export function TemplateInput({
  value,
  onChange,
  fields,
  placeholder,
  multiline,
  rows = 4,
}: {
  value: string;
  onChange: (v: string) => void;
  fields: FieldInfo[];
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
}) {
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const insert = (name: string) => {
    const el = ref.current;
    const token = `{{${name}}}`;
    if (!el) return onChange(value + token);
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + token + value.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };
  const usable = fields.filter((f) => f.kind !== "rows");
  return (
    <div>
      {multiline ? (
        <textarea
          ref={ref}
          value={value}
          rows={rows}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${inputCls} resize-y leading-relaxed`}
        />
      ) : (
        <input ref={ref} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={inputCls} />
      )}
      {usable.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <span className="mr-0.5 text-[11.5px] text-muted">Insert:</span>
          {usable.map((f) => (
            <Chip key={f.name} field={f} onClick={() => insert(f.name)} />
          ))}
        </div>
      )}
    </div>
  );
}

export function FieldSelect({
  value,
  onChange,
  fields,
  kinds,
  placeholder = "Choose a field…",
}: {
  value: string;
  onChange: (v: string) => void;
  fields: FieldInfo[];
  kinds?: FieldInfo["kind"][];
  placeholder?: string;
}) {
  const options = fields.filter((f) => !kinds || kinds.includes(f.kind));
  const missing = value && !options.some((f) => f.name === value);
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      <option value="">{placeholder}</option>
      {missing && <option value={value}>{value} (not available here)</option>}
      {options.map((f) => (
        <option key={f.name} value={f.name}>
          {f.name}
        </option>
      ))}
    </select>
  );
}

export function Select<T extends string | number>({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: T | "";
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  placeholder?: string;
}) {
  return (
    <select
      value={String(value)}
      onChange={(e) => {
        const o = options.find((x) => String(x.value) === e.target.value);
        if (o) onChange(o.value);
      }}
      className={inputCls}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Pill-style single choice, e.g. Every hour / day / week. */
export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; title?: string }[];
  size?: "sm" | "md";
}) {
  return (
    <div className="flex w-full rounded-full bg-sand p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          title={o.title}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-full font-medium transition ${size === "sm" ? "py-1 text-[12.5px]" : "py-1.5 text-[13.5px]"} ${
            o.value === value ? "bg-paper text-ink shadow-[0_1px_3px_rgb(46_31_31/0.15)]" : "text-muted hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");
const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "AM" : "PM"}`;

/** "HH:MM" picker as two dropdowns with friendly 12-hour labels. */
export function TimeSelect({ value, onChange, minuteOnly }: { value: string; onChange: (v: string) => void; minuteOnly?: boolean }) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value ?? "");
  const h = m ? Number(m[1]) : 9;
  const min = m ? Number(m[2]) : 0;
  const minutes = [0, 15, 30, 45].includes(min) ? [0, 15, 30, 45] : [0, 15, 30, 45, min].sort((a, b) => a - b);
  return (
    <div className="flex items-center gap-2">
      {!minuteOnly && (
        <div className="min-w-0 flex-1">
          <select value={h} onChange={(e) => onChange(`${pad(Number(e.target.value))}:${pad(min)}`)} className={inputCls}>
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>
                {hourLabel(i)}
              </option>
            ))}
          </select>
        </div>
      )}
      {!minuteOnly && <span className="text-muted">:</span>}
      <div className={minuteOnly ? "min-w-0 flex-1" : "w-[96px] shrink-0"}>
        <select value={min} onChange={(e) => onChange(`${pad(h)}:${pad(Number(e.target.value))}`)} className={inputCls}>
          {minutes.map((x) => (
            <option key={x} value={x}>
              {minuteOnly ? `:${pad(x)} past the hour` : pad(x)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

/** − value + control for small whole numbers. */
export function Stepper({
  value,
  onChange,
  min = 1,
  max = 120,
  step = 5,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const btn = "grid size-9 place-items-center rounded-full text-[18px] leading-none text-ink-2 hover:bg-sand disabled:opacity-30";
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-paper p-1 ring-1 ring-line-strong">
      <button type="button" className={btn} onClick={() => onChange(clamp(value - step))} disabled={value <= min} aria-label="Less">
        −
      </button>
      <span className="min-w-[72px] text-center text-[15px] font-semibold tabular-nums">
        {value}
        {suffix && <span className="ml-1 font-normal text-muted">{suffix}</span>}
      </span>
      <button type="button" className={btn} onClick={() => onChange(clamp(value + step))} disabled={value >= max} aria-label="More">
        +
      </button>
    </div>
  );
}
