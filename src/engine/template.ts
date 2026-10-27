import type { Item, Value } from "./types";

const TOKEN = /\{\{\s*([\w.]+)\s*\}\}/g;

export function valueToText(v: Value | undefined): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) {
    return v
      .map((x) => (x !== null && typeof x === "object" ? JSON.stringify(x) : String(x ?? "")))
      .join(", ");
  }
  return String(v);
}

/** Render "{{field}}" tokens against an item. Missing fields render as "" and are reported. */
export function render(template: string, item: Item, missing?: Set<string>): string {
  return template.replace(TOKEN, (_, name: string) => {
    if (!(name in item)) {
      missing?.add(name);
      return "";
    }
    return valueToText(item[name]);
  });
}

export function tokensIn(template: string): string[] {
  return [...template.matchAll(TOKEN)].map((m) => m[1]);
}
