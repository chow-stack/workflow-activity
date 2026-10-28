import { patch, wf } from "@/engine/build";
import type { Level, Row, SlackExpect } from "@/engine/types";

const reference = wf(
  [
    ["s", "trigger.schedule", { frequency: "day", time: "21:00" }],
    ["read", "data.readSheet", { sheet: "Inventory" }],
    ["each", "data.forEach", { field: "rows" }],
    ["low", "logic.filter", { match: "all", conditions: [{ field: "stock", op: "lt", value: "{{reorder_level}}" }] }],
    ["msg", "action.slack", { channel: "#manager", message: "Running low on {{item}}: {{stock}} {{unit}} left" }],
  ],
  [
    ["s", "read"],
    ["read", "each"],
    ["each", "low"],
    ["low", "msg", "kept"],
  ],
);

const item = (item: string, stock: number, reorder_level: number, unit: string): Row => ({ item, stock, reorder_level, unit });

const INVENTORY: Row[] = [
  item("Oat milk", 2, 6, "cartons"),
  item("Espresso beans", 3, 10, "lbs"),
  item("Cups 12oz", 40, 100, "cups"),
  item("Whole milk", 6, 6, "gallons"),
  item("Vanilla syrup", 5, 3, "bottles"),
  item("Lids 12oz", 150, 100, "lids"),
  item("Chai concentrate", 4, 2, "cartons"),
  item("Napkins", 900, 300, "packs"),
];

const STOCKED: Row[] = INVENTORY.map((r) => ({ ...r, stock: Math.max(Number(r.stock), Number(r.reorder_level) + 4) }));

const alert = (name: string): SlackExpect => ({ channel: "#manager", includes: [name] });

export const level: Level = {
  id: 7,
  slug: "low-stock",
  title: "Low-Stock Alerts",
  tier: "expert",
  points: 400,
  skill: "Loops",
  skillHow: "Read sheet loads every row of a sheet as one list. For each then runs the next steps once per row, so each row's columns become fields.",
  task: "Every night at 9 PM, check the Inventory sheet and post one Slack message in #manager for each item that's below its reorder level.",
  goals: ["Run every night at 9:00 PM", "Look at every row of Inventory", "One #manager message per item whose stock is below its reorder_level"],
  trigger: "schedule",
  palette: ["trigger.schedule", "data.readSheet", "data.forEach", "logic.filter", "logic.ifElse", "action.slack", "action.email"],
  channels: ["#manager", "#general"],
  sheets: { Inventory: { columns: ["item", "stock", "reorder_level", "unit"] } },
  tests: [
    {
      id: "t1",
      label: "A busy Tuesday",
      hidden: false,
      input: { window: { startWeekday: 2, days: 1 }, sheets: { Inventory: INVENTORY } },
      expect: { slack: [alert("Oat milk"), alert("Espresso beans"), alert("Cups 12oz")] },
      failHint: "Compare each item's stock to its own reorder_level. Whole milk is exactly at its level, so it isn't low.",
    },
    {
      id: "t2",
      label: "Everything is stocked",
      hidden: true,
      input: { window: { startWeekday: 2, days: 1 }, sheets: { Inventory: STOCKED } },
      expect: {},
      failHint: "When nothing is low, the manager shouldn't get any messages.",
    },
  ],
  ai: {},
  hints: [
    "Schedule → Read sheet → For each → Filter → Slack. The filter compares two columns of the same row.",
    "Filter: stock · is less than · {{reorder_level}} (click the reorder_level chip for the value). Slack message: {{item}}: {{stock}} {{unit}} left.",
  ],
  reference,
  traps: [
    {
      name: "at most instead of less than",
      workflow: patch(reference, "low", { conditions: [{ field: "stock", op: "lte", value: "{{reorder_level}}" }] }),
      shouldFail: ["t1"],
    },
    { name: "weekly on Monday", workflow: patch(reference, "s", { frequency: "week", weekday: 1 }), shouldFail: ["t1"] },
    {
      name: "fixed threshold",
      workflow: patch(reference, "low", { conditions: [{ field: "stock", op: "lt", value: "5" }] }),
      shouldFail: ["t1"],
    },
  ],
};
