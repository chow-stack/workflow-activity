// Simulated AI. Answers come from per-level fixtures keyed by the exact source text,
// so pointing a block at the wrong field (or giving it the wrong labels) visibly breaks it.
import { toNumber } from "./conditions";
import { tokensIn, valueToText } from "./template";
import type { AiFixtures, Item, Scalar, Value } from "./types";

export const normalizeName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const ALIASES: Record<string, string[]> = {
  gpa: ["gradepointaverage", "gradepoint", "grades", "gpascore"],
  skills: ["skill", "skillset", "skilllist", "tools", "technicalskills"],
  major: ["fieldofstudy", "degree", "concentration", "study"],
  name: ["fullname", "applicant", "candidate", "applicantname"],
  experience: ["yearsexperience", "yearsofexperience", "years", "workexperience"],
};

function resolveCanonical(name: string, available: string[]): string | null {
  const n = normalizeName(name);
  for (const key of available) {
    const k = normalizeName(key);
    if (n === k || ALIASES[k]?.includes(n)) return key;
  }
  for (const key of available) {
    const k = normalizeName(key);
    if (k.length >= 3 && n.includes(k)) return key;
  }
  return null;
}

const key = (v: Value | undefined) => valueToText(v).trim();

export function classify(ai: AiFixtures, text: Value | undefined, labelsCsv: string): string {
  const labels = labelsCsv
    .split(",")
    .map((l) => l.trim().toLowerCase())
    .filter(Boolean);
  const truth = ai.classify?.[key(text)];
  if (truth && labels.includes(truth.toLowerCase())) return truth.toLowerCase();
  return "unknown";
}

export type ExtractType = "text" | "number" | "list";

export function extract(
  ai: AiFixtures,
  text: Value | undefined,
  fields: { name: string; type: ExtractType }[],
): Record<string, Value> {
  const fixture = ai.extract?.[key(text)] ?? {};
  const available = Object.keys(fixture);
  const out: Record<string, Value> = {};
  for (const f of fields) {
    if (!f.name.trim()) continue;
    const canon = resolveCanonical(f.name, available);
    const raw = canon ? fixture[canon] : undefined;
    out[f.name.trim()] = coerce(raw, f.type);
  }
  return out;
}

function coerce(raw: Scalar | Scalar[] | undefined, type: ExtractType): Value {
  if (raw === undefined || raw === null) return null;
  if (type === "list") {
    if (Array.isArray(raw)) return raw;
    return String(raw)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (type === "number") {
    const s = Array.isArray(raw) ? raw[0] : raw;
    const direct = toNumber(s);
    if (direct !== null) return direct;
    const m = String(s).match(/-?\d+(\.\d+)?/);
    return m ? Number(m[0]) : null;
  }
  return Array.isArray(raw) ? raw.join(", ") : String(raw);
}

/** Fill the level's template; a slot is only filled if the instructions reference that field. */
export function write(ai: AiFixtures, instructions: string, item: Item): string {
  const fx = ai.write;
  if (!fx) return "Thanks for reaching out!";
  const referenced = new Set(tokensIn(instructions));
  return fx.template.replace(/\{(\w+)\}/g, (_, slot: string) => {
    if (referenced.has(slot) && slot in item) {
      const v = valueToText(item[slot]);
      return fx.format?.[slot]?.replace("{v}", v) ?? v;
    }
    return fx.fallbacks[slot] ?? "";
  });
}
