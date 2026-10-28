import { patch, wf } from "@/engine/build";
import type { Level, Row } from "@/engine/types";

const reference = wf(
  [
    ["s", "trigger.schedule", { frequency: "day", time: "09:00" }],
    ["read", "data.readSheet", { sheet: "Invoices" }],
    ["each", "data.forEach", { field: "rows" }],
    [
      "late",
      "logic.filter",
      {
        match: "all",
        conditions: [
          { field: "status", op: "equals", value: "Unpaid" },
          { field: "days_overdue", op: "gt", value: "30" },
        ],
      },
    ],
    [
      "write",
      "ai.write",
      {
        instructions:
          "Write a short, polite payment reminder to {{client}} about invoice {{invoice_id}} for {{amount}}, which is {{days_overdue}} days overdue.",
        output: "ai_text",
      },
    ],
    ["mail", "action.email", { to: "{{client_email}}", subject: "Friendly reminder: invoice {{invoice_id}}", body: "{{ai_text}}" }],
    ["sum", "data.combine", { lineTemplate: "", sumField: "amount" }],
    ["owner", "action.slack", { channel: "#owner", message: "{{count}} overdue invoices, ${{sum_amount}} outstanding" }],
  ],
  [
    ["s", "read"],
    ["read", "each"],
    ["each", "late"],
    ["late", "write", "kept"],
    ["write", "mail"],
    ["late", "sum", "kept"],
    ["sum", "owner"],
  ],
);

const inv = (invoice_id: string, client: string, client_email: string, amount: number, days_overdue: number, status: string): Row => ({
  invoice_id,
  client,
  client_email,
  amount,
  days_overdue,
  status,
});

const INVOICES: Row[] = [
  inv("INV-101", "Hoosier Print Co", "billing@hoosierprint.example", 600, 5, "Paid"),
  inv("INV-102", "Monroe Law Group", "ap@monroelaw.example", 1500, 50, "Paid"),
  inv("INV-104", "Lakeside Dental", "office@lakesidedental.example", 1200, 45, "Unpaid"),
  inv("INV-106", "Sample Gates Bakery", "hello@samplegates.example", 300, 2, "Paid"),
  inv("INV-107", "Bloom Florals", "accounts@bloomflorals.example", 850, 62, "Unpaid"),
  inv("INV-109", "Cardinal Yoga", "studio@cardinalyoga.example", 400, 30, "Unpaid"),
  inv("INV-111", "Kirkwood Cycles", "shop@kirkwoodcycles.example", 2200, 33, "Unpaid"),
  inv("INV-112", "B-Town Tutors", "team@btowntutors.example", 950, 12, "Unpaid"),
];

const reminder = (client: string, to: string, id: string, amount: number) => ({
  to,
  bodyIncludes: [client, id],
  includesNumber: [amount],
});

export const level: Level = {
  id: 8,
  slug: "invoice-chaser",
  title: "Invoice Chaser",
  tier: "expert",
  points: 400,
  skill: "AI Write + Combine",
  skillHow: "AI Write drafts text, but it only knows the fields you put in its instructions. Combine bundles many items into one so you can send a single summary.",
  task: "Every day at 9 AM, email a reminder to each client with an unpaid invoice more than 30 days overdue, then post one summary in Slack #owner.",
  goals: ["Only invoices that are Unpaid AND more than 30 days overdue", "One reminder per invoice, to the client, naming the client, invoice number and amount", "One #owner message with how many are overdue and the total"],
  trigger: "schedule",
  palette: ["trigger.schedule", "data.readSheet", "data.forEach", "logic.filter", "logic.ifElse", "ai.write", "data.combine", "action.email", "action.slack"],
  channels: ["#owner", "#general"],
  sheets: { Invoices: { columns: ["invoice_id", "client", "client_email", "amount", "days_overdue", "status"] } },
  tests: [
    {
      id: "t1",
      label: "Monday's invoice check",
      hidden: false,
      input: { window: { startWeekday: 1, days: 1 }, sheets: { Invoices: INVOICES } },
      expect: {
        emails: [
          reminder("Lakeside Dental", "office@lakesidedental.example", "INV-104", 1200),
          reminder("Bloom Florals", "accounts@bloomflorals.example", "INV-107", 850),
          reminder("Kirkwood Cycles", "shop@kirkwoodcycles.example", "INV-111", 2200),
        ],
        slack: [{ channel: "#owner", includesNumber: [3, 4250] }],
      },
      failHint:
        "Check three things: who qualifies (Unpaid AND more than 30 days), whether each reminder names the client, invoice and amount (the AI only knows what you tell it), and whether the owner gets exactly one summary.",
    },
    {
      id: "t2",
      label: "Everyone paid",
      hidden: true,
      input: { window: { startWeekday: 1, days: 1 }, sheets: { Invoices: INVOICES.map((r) => ({ ...r, status: "Paid" })) } },
      expect: {},
      failHint: "When nothing is overdue, nobody should get an email and the owner shouldn't get a summary.",
    },
  ],
  ai: {
    write: {
      template:
        "Hi {client}, this is a friendly reminder that {invoice_id} for {amount} is now {days_overdue} past due. Please let us know if you have any questions. Thank you!",
      format: { invoice_id: "invoice {v}", amount: "${v}", days_overdue: "{v} days" },
      fallbacks: { client: "there", invoice_id: "your recent invoice", amount: "the outstanding balance", days_overdue: "a while" },
    },
  },
  hints: [
    "After the filter there are two jobs: one per invoice (the emails) and one for all of them (the summary). Connect the filter to both.",
    "Filter (status equals Unpaid AND days_overdue > 30) → AI Write using {{client}}, {{invoice_id}}, {{amount}}, {{days_overdue}} → Send email to {{client_email}} with {{ai_text}}. Also Filter → Combine (sum of amount) → Slack #owner “{{count}} overdue invoices, ${{sum_amount}} outstanding”.",
  ],
  reference,
  traps: [
    {
      name: "≥ 30 days",
      workflow: patch(reference, "late", {
        conditions: [
          { field: "status", op: "equals", value: "Unpaid" },
          { field: "days_overdue", op: "gte", value: "30" },
        ],
      }),
      shouldFail: ["t1"],
    },
    {
      name: "no status check",
      workflow: patch(reference, "late", { conditions: [{ field: "days_overdue", op: "gt", value: "30" }] }),
      shouldFail: ["t1"],
    },
    {
      name: "AI never told the amount",
      workflow: patch(reference, "write", { instructions: "Write a polite reminder to {{client}} about invoice {{invoice_id}}." }),
      shouldFail: ["t1"],
    },
    {
      name: "summary inside the loop",
      workflow: {
        ...reference,
        nodes: reference.nodes.filter((n) => n.id !== "sum"),
        edges: reference.edges.filter((e) => e.source !== "sum" && e.target !== "sum").concat({ id: "e-mail-owner", source: "mail", sourceHandle: "out", target: "owner" }),
      },
      shouldFail: ["t1"],
    },
    { name: "combine without a total", workflow: patch(reference, "sum", { sumField: "" }), shouldFail: ["t1"] },
  ],
};
