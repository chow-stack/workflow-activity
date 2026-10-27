"use client";

import type { Item, Row, TestInput } from "@/engine/types";
import { WEEKDAYS } from "@/engine/schedule";

export function Table({ rows, columns }: { rows: Row[] | Item[]; columns?: string[] }) {
  const cols = columns ?? [...new Set(rows.flatMap((r) => Object.keys(r)))];
  if (rows.length === 0) return <div className="text-[12px] text-ink-muted italic">No rows</div>;
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full border-collapse font-mono text-[11.5px]">
        <thead>
          <tr className="bg-cream">
            {cols.map((c) => (
              <th key={c} className="border-b border-line px-2.5 py-1.5 text-left font-medium whitespace-nowrap text-ink-muted">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line/70 last:border-0">
              {cols.map((c) => (
                <td key={c} className="max-w-[260px] truncate px-2.5 py-1.5 whitespace-nowrap" title={String(r[c] ?? "")}>
                  {Array.isArray(r[c]) ? (r[c] as unknown[]).join(", ") : String(r[c] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** What a test feeds into the workflow: events, a time window, and sheet contents. */
export function InputPreview({ input }: { input: TestInput }) {
  return (
    <div className="space-y-3">
      {input.window && (
        <div className="text-[12.5px] text-ink">
          Simulated time: {WEEKDAYS[input.window.startWeekday]}
          {input.window.days > 1 ? ` → ${WEEKDAYS[(input.window.startWeekday + input.window.days - 1) % 7]}` : ""} (
          {input.window.days === 1 ? "one day" : `${input.window.days} days`})
        </div>
      )}
      {input.events && input.events.length > 0 && <Table rows={input.events} />}
      {input.sheets &&
        Object.entries(input.sheets).map(([name, rows]) => (
          <div key={name}>
            <div className="mb-1 text-[11.5px] font-medium text-ink-muted">Sheet: {name}</div>
            <Table rows={rows} />
          </div>
        ))}
    </div>
  );
}
