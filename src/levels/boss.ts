import { NODES } from "@/engine/nodes";
import type { Level, NodeType } from "@/engine/types";

export const boss: Level = {
  id: 9,
  slug: "boss",
  title: "Design Your Own",
  tier: "boss",
  points: 0,
  teaches: "Spotting automation opportunities in the real world.",
  brief:
    "Pick a real, annoying task from your life, a job, a club, or a business you know. Design the workflow that would automate it. There are no tests: give it a title and a one-line pitch, then submit. The room votes on the best one.",
  goals: ["A real problem", "A complete workflow from trigger to action", "A 60-second pitch"],
  trigger: null,
  palette: Object.keys(NODES) as NodeType[],
  form: { title: "Any form", fields: ["name", "email", "message"] },
  channels: ["#general", "#team", "#alerts"],
  sheets: { "Main sheet": { columns: ["Name", "Email", "Notes", "Amount", "Status"] } },
  tests: [],
  ai: {},
  hints: [],
  reference: null,
  traps: [],
};
