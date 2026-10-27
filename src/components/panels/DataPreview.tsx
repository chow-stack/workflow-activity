"use client";

import { Clock } from "lucide-react";
import { WEEKDAYS } from "@/engine/schedule";
import type { Item, Row, TestInput } from "@/engine/types";

export function Table({ rows, columns }: { rows: Row[] | Item[]; columns?: string[] }) {
  const cols = columns ?? [...new Set(rows.flatMap((r) => Object.keys(r)))];
  if (rows.length === 0) return <div className="text-[12.5px] text-muted italic">No rows</div>;
  return (
    <div className="overflow-x-auto rounded border border-line bg-paper">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="bg-cream">
            {cols.map((c) => (
              <th key={c} className="border-b border-line px-2.5 py-1.5 text-left font-mono font-medium whitespace-nowrap text-muted">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line last:border-0">
              {cols.map((c) => (
                <td key={c} className="max-w-[260px] truncate px-2.5 py-1.5 whitespace-nowrap text-ink-2" title={String(r[c] ?? "")}>
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

/** One record shown as label/value pairs. Easier to read than a wide table. */
function Record_({ item }: { item: Item }) {
  return (
    <dl className="divide-y divide-line overflow-hidden rounded border border-line bg-paper text-[12.5px]">
      {Object.entries(item).map(([k, v]) => (
        <div key={k} className="flex gap-3 px-2.5 py-1.5">
          <dt className="w-[92px] shrink-0 font-mono text-[11.5px] text-crimson">{k}</dt>
          <dd className="min-w-0 break-words text-ink-2">{Array.isArray(v) ? v.join(", ") : String(v ?? "")}</dd>
        </div>
      ))}
    </dl>
  );
}

/** What a test feeds into the workflow: events, a time window, and sheet contents. */
export function InputPreview({ input }: { input: TestInput }) {
  return (
    <div className="space-y-3">
      {input.window && (
        <div className="flex items-center gap-1.5 rounded bg-cream px-2.5 py-1.5 text-[12.5px] text-ink-2">
          <Clock size={13} className="text-muted" /> Simulated time: {WEEKDAYS[input.window.startWeekday]}
          {input.window.days > 1 ? ` to ${WEEKDAYS[(input.window.startWeekday + input.window.days - 1) % 7]}` : ""} (
          {input.window.days === 1 ? "one day" : `${input.window.days} days`})
        </div>
      )}
      {input.events?.map((e, i) => <Record_ key={i} item={e} />)}
      {input.sheets &&
        Object.entries(input.sheets).map(([name, rows]) => (
          <div key={name}>
            <div className="mb-1 text-[12px] font-medium text-muted">Sheet “{name}”</div>
            <Table rows={rows} />
          </div>
        ))}
    </div>
  );
}
