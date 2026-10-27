"use client";

import { useRef, type ReactNode } from "react";
import type { FieldInfo } from "@/engine/types";

export const inputCls =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition placeholder:text-ink-muted/60 focus:border-crimson/50 focus:ring-2 focus:ring-crimson/15";

export function Label({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-2">
      <span className="text-[12.5px] font-medium text-ink">{children}</span>
      {hint && <span className="text-[11px] text-ink-muted">{hint}</span>}
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

const KIND_MARK: Record<FieldInfo["kind"], string> = { text: "Aa", number: "#", list: "[ ]", rows: "▦" };

export function Chip({ field, onClick }: { field: FieldInfo; onClick: () => void }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={`Insert {{${field.name}}}`}
      className="inline-flex items-center gap-1 rounded-full border border-crimson/20 bg-crimson/[0.06] px-2 py-0.5 font-mono text-[11px] text-crimson transition hover:border-crimson/50 hover:bg-crimson/10"
    >
      <span className="text-[9px] opacity-60">{KIND_MARK[field.kind]}</span>
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
    const next = value.slice(0, start) + token + value.slice(end);
    onChange(next);
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
          className={`${inputCls} resize-y font-mono text-[12.5px] leading-relaxed`}
        />
      ) : (
        <input
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${inputCls} font-mono text-[12.5px]`}
        />
      )}
      {usable.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
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
  placeholder = "Pick a field…",
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
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`${inputCls} font-mono text-[12.5px]`}>
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
