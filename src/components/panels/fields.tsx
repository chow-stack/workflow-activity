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
