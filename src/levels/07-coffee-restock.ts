import { patch, wf } from "@/engine/build";
import type { Level, Row } from "@/engine/types";

const SUPPLIER = "orders@midwestroasters.example";

const reference = wf(
  [
    ["s", "trigger.schedule", { frequency: "day", time: "21:00" }],
    ["read", "data.readSheet", { sheet: "Inventory" }],
    ["each", "data.forEach", { field: "rows" }],
    ["low", "logic.filter", { match: "all", conditions: [{ field: "stock", op: "lt", value: "{{reorder_level}}" }] }],
    ["bundle", "data.combine", { lineTemplate: "{{item}}: {{stock}} {{unit}} left", sumField: "" }],
    ["order", "action.email", { to: SUPPLIER, subject: "Hoosier Bean restock order", body: "Hi! Please send restocks for:\n{{lines}}" }],
  ],
  [
    ["s", "read"],
    ["read", "each"],
    ["each", "low"],
    ["low", "bundle", "kept"],
    ["bundle", "order"],
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

export const level: Level = {
  id: 7,
  slug: "coffee-restock",
  title: "Coffee Shop Restock",
  tier: "expert",
  points: 400,
  teaches: "Loops: go through every row, keep some, then collect them before acting once.",
  brief: `Every night at 9 PM, Hoosier Bean checks its Inventory sheet. Anything with stock below its reorder level goes into ONE order email to the supplier (${SUPPLIER}). If nothing is low, send nothing.`,
  goals: ["Runs every night at 21:00", "Only items with stock below reorder_level", "Exactly one email listing every low item", "No email when nothing is low"],
  trigger: "schedule",
  palette: ["trigger.schedule", "data.readSheet", "data.forEach", "logic.filter", "logic.ifElse", "data.combine", "action.email", "action.slack"],
  channels: ["#manager", "#general"],
  sheets: { Inventory: { columns: ["item", "stock", "reorder_level", "unit"] } },
  tests: [
    {
      id: "t1",
      label: "A busy Tuesday",
      hidden: false,
      input: { window: { startWeekday: 2, days: 1 }, sheets: { Inventory: INVENTORY } },
      expect: {
        emails: [
          {
            to: SUPPLIER,
            bodyIncludes: ["Oat milk", "Espresso beans", "Cups 12oz"],
            bodyExcludes: ["Whole milk", "Vanilla syrup", "Lids 12oz", "Chai concentrate", "Napkins"],
          },
        ],
      },
      failHint: "The supplier wants one order with every low item, and nothing that's at or above its reorder level.",
    },
    {
      id: "t2",
      label: "Everything is stocked",
      hidden: true,
      input: { window: { startWeekday: 2, days: 1 }, sheets: { Inventory: STOCKED } },
      expect: {},
      failHint: "When nothing is low, the supplier shouldn't get an email.",
    },
  ],
  ai: {},
  hints: [
    "Read the sheet, go through each row, keep the low ones, then bundle them before emailing.",
    "Schedule (every day, 21:00) → Read sheet → For each rows → Filter stock < {{reorder_level}} → Combine (line template {{item}}: {{stock}} {{unit}}) → Send email with {{lines}} in the body.",
  ],
  reference,
  traps: [
    {
      name: "no combine",
      workflow: {
        ...reference,
        nodes: reference.nodes.filter((n) => n.id !== "bundle").map((n) => (n.id === "order" ? { ...n, config: { ...n.config, body: "Please send {{item}}" } } : n)),
        edges: reference.edges.filter((e) => e.source !== "bundle" && e.target !== "bundle").concat({ id: "e-low-order", source: "low", sourceHandle: "kept", target: "order" }),
      },
      shouldFail: ["t1"],
    },
    {
      name: "≤ instead of <",
      workflow: patch(reference, "low", { conditions: [{ field: "stock", op: "lte", value: "{{reorder_level}}" }] }),
      shouldFail: ["t1"],
    },
    { name: "weekly on Monday", workflow: patch(reference, "s", { frequency: "week", weekday: 1 }), shouldFail: ["t1"] },
    {
      name: "literal threshold",
      workflow: patch(reference, "low", { conditions: [{ field: "stock", op: "lt", value: "5" }] }),
      shouldFail: ["t1"],
    },
  ],
};
