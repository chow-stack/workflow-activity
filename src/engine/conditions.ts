import { render } from "./template";
import type { Condition, Item, Op, Value } from "./types";

export const OPS: { op: Op; label: string; long?: string; needsValue: boolean }[] = [
  { op: "equals", label: "equals", needsValue: true },
  { op: "notEquals", label: "does not equal", needsValue: true },
  { op: "contains", label: "contains", needsValue: true },
  { op: "notContains", label: "does not contain", needsValue: true },
  { op: "startsWith", label: "starts with", needsValue: true },
  { op: "endsWith", label: "ends with", needsValue: true },
  { op: "endsWithAny", label: "ends with any of", needsValue: true },
  { op: "gt", long: "is greater than (>)", label: ">", needsValue: true },
  { op: "gte", long: "is at least (≥)", label: "≥", needsValue: true },
  { op: "lt", long: "is less than (<)", label: "<", needsValue: true },
  { op: "lte", long: "is at most (≤)", label: "≤", needsValue: true },
  { op: "empty", label: "is empty", needsValue: false },
  { op: "notEmpty", label: "is not empty", needsValue: false },
];

export function opLabel(op: Op): string {
  return OPS.find((o) => o.op === op)?.label ?? op;
}

export function toNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const s = v.trim().replace(/^\$/, "").replace(/,/g, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

function isEmpty(v: Value | undefined): boolean {
  if (v === null || v === undefined) return true;
  if (Array.isArray(v)) return v.length === 0;
  return String(v).trim() === "";
}

function compareScalar(op: Op, left: unknown, right: string): boolean {
  const ln = toNumber(left);
  const rn = toNumber(right);
  const ls = norm(left);
  const rs = norm(right);
  switch (op) {
    case "equals":
      return ln !== null && rn !== null ? ln === rn : ls === rs;
    case "notEquals":
      return !(ln !== null && rn !== null ? ln === rn : ls === rs);
    case "contains":
      return ls.includes(rs);
    case "notContains":
      return !ls.includes(rs);
    case "startsWith":
      return ls.startsWith(rs);
    case "endsWith":
      return ls.endsWith(rs);
    case "endsWithAny":
      return rs
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .some((s) => ls.endsWith(s));
    case "gt":
      return ln !== null && rn !== null && ln > rn;
    case "gte":
      return ln !== null && rn !== null && ln >= rn;
    case "lt":
      return ln !== null && rn !== null && ln < rn;
    case "lte":
      return ln !== null && rn !== null && ln <= rn;
    default:
      return false;
  }
}

export function evalCondition(c: Condition, item: Item): boolean {
  const left = item[c.field];
  if (c.op === "empty") return isEmpty(left);
  if (c.op === "notEmpty") return !isEmpty(left);
  const right = render(c.value ?? "", item);
  if (Array.isArray(left)) {
    // Lists: positive ops match if any element matches; negative ops require none to match.
    if (c.op === "notContains") return !left.some((x) => compareScalar("contains", x, right));
    if (c.op === "notEquals") return !left.some((x) => compareScalar("equals", x, right));
    return left.some((x) => compareScalar(c.op, x, right));
  }
  return compareScalar(c.op, left, right);
}

export function evalConditions(conds: Condition[], match: "all" | "any", item: Item): boolean {
  if (conds.length === 0) return true;
  return match === "any"
    ? conds.some((c) => evalCondition(c, item))
    : conds.every((c) => evalCondition(c, item));
}
