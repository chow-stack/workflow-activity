"use client";

import { Check, ChevronDown, Clock } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
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

/** Outlined pill chips for a single choice (Zapier-style). */
export function ChipGroup<T extends string | number>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`rounded-full px-3.5 py-1.5 text-[13.5px] font-medium transition ${
              on ? "bg-crimson-soft text-crimson ring-[1.5px] ring-crimson" : "bg-paper text-ink-2 ring-1 ring-line-strong hover:ring-ink-2"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Seven round day buttons, Monday first. Value is 0 = Sunday … 6 = Saturday. */
export function DayPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1.5" role="radiogroup">
      {[1, 2, 3, 4, 5, 6, 0].map((d) => {
        const on = d === value;
        return (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={DAY_NAMES[d]}
            title={DAY_NAMES[d]}
            onClick={() => onChange(d)}
            className={`grid size-9 place-items-center rounded-full text-[13px] font-semibold transition ${
              on ? "bg-crimson text-paper" : "bg-paper text-ink-2 ring-1 ring-line-strong hover:ring-ink-2"
            }`}
          >
            {DAYS[d]}
          </button>
        );
      })}
    </div>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");
const parseHM = (v: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v ?? "");
  return m ? { h: Number(m[1]), m: Number(m[2]) } : { h: 9, m: 0 };
};
export const clockLabel = (v: string) => {
  const { h, m } = parseHM(v);
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(m)} ${h < 12 ? "AM" : "PM"}`;
};

/** One button showing "8:00 AM"; opens a scrollable list of times every 30 minutes. */
export function TimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const { h, m } = parseHM(value);
  const current = `${pad(h)}:${pad(m)}`;
  const half = Array.from({ length: 48 }, (_, i) => `${pad(Math.floor(i / 2))}:${i % 2 ? "30" : "00"}`);
  const times = half.includes(current) ? half : [...half, current].sort();

  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>("[aria-selected=true]")?.scrollIntoView({ block: "center" });
    const close = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={root} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex items-center gap-2 rounded-full bg-paper py-1.5 pr-3 pl-3.5 text-[14px] font-semibold tabular-nums transition ${
          open ? "ring-[1.5px] ring-ink" : "ring-1 ring-line-strong hover:ring-ink-2"
        }`}
      >
        <Clock size={15} className="text-muted" />
        {clockLabel(current)}
        <ChevronDown size={15} className={`text-muted transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          ref={list}
          role="listbox"
          className="animate-pop absolute top-full left-0 z-30 mt-1.5 max-h-[232px] w-[148px] overflow-y-auto rounded-lg bg-paper p-1 shadow-[0_12px_32px_rgb(46_31_31/0.14)] ring-1 ring-line"
        >
          {times.map((t) => {
            const on = t === current;
            return (
              <button
                key={t}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => {
                  onChange(t);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-[13.5px] tabular-nums ${
                  on ? "bg-crimson-soft font-semibold text-crimson" : "text-ink-2 hover:bg-cream"
                }`}
              >
                {clockLabel(t)}
                {on && <Check size={14} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Minute past the hour, for hourly schedules. */
export function MinutePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { h, m } = parseHM(value);
  return (
    <ChipGroup
      value={m}
      onChange={(min) => onChange(`${pad(h)}:${pad(min)}`)}
      options={[0, 15, 30, 45].map((x) => ({ value: x, label: `:${pad(x)}` }))}
    />
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
