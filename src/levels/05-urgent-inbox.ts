import { patch, wf } from "@/engine/build";
import type { Level, TestCase } from "@/engine/types";

const reference = wf(
  [
    ["t", "trigger.email"],
    ["ai", "ai.classify", { field: "body", labels: "urgent, not urgent", output: "label" }],
    ["if", "logic.ifElse", { match: "all", conditions: [{ field: "label", op: "equals", value: "urgent" }] }],
    ["alert", "action.slack", { channel: "#urgent", message: "Urgent: {{subject}} (from {{from_name}})" }],
    ["log", "action.sheetRow", { sheet: "Inbox", values: { From: "{{from}}", Subject: "{{subject}}" } }],
  ],
  [
    ["t", "ai"],
    ["ai", "if"],
    ["if", "alert", "true"],
    ["if", "log", "false"],
  ],
);

type Kind = "urgent" | "not urgent";
const EMAILS: [id: string, label: string, hidden: boolean, from: string, from_name: string, subject: string, body: string, kind: Kind][] = [
  ["t1", "The venue is double-booked", false, "events@iu.edu", "IU Events", "Room conflict tonight",
    "Your 6pm meeting room was double-booked. Please pick a new room in the next hour or the meeting is cancelled.", "urgent"],
  ["t2", "A weekly newsletter", false, "news@iu.edu", "Kelley Weekly", "This week at Kelley",
    "Here's what's happening around Kelley this week: career fair recap, new study rooms, and more.", "not urgent"],
  ["t3", "A sponsor needs an answer today", true, "anna@techcorp.example", "Anna Ruiz", "Quick question",
    "No rush on most things, but I need your logo file by 5pm today or we can't print the banner.", "urgent"],
  ["t4", "A shouty sale email", true, "deals@shop.example", "Campus Shop", "URGENT!!! 50% OFF HOODIES",
    "Our biggest hoodie sale of the semester is here. Shop online anytime this month.", "not urgent"],
];

const tests: TestCase[] = EMAILS.map(([id, label, hidden, from, from_name, subject, body, kind]) => ({
  id,
  label,
  hidden,
  input: { events: [{ from, from_name, subject, body }] },
  expect:
    kind === "urgent"
      ? { slack: [{ channel: "#urgent", includes: [subject] }] }
      : { rows: [{ sheet: "Inbox", match: { From: from, Subject: subject } }] },
  failHint:
    id === "t3"
      ? "This one sounds relaxed but has a same-day deadline. Is the AI reading the email body?"
      : id === "t4"
        ? "Shouting in the subject doesn't make it urgent. Let the AI read the actual message."
        : undefined,
}));

export const level: Level = {
  id: 5,
  slug: "urgent-inbox",
  title: "Urgent Inbox",
  tier: "hard",
  points: 300,
  skill: "AI Classify + If/Else",
  skillHow: "AI Classify reads text and picks one of your labels. If/Else then sends each item down a true path or a false path.",
  task: "Use AI to spot urgent emails. Urgent ones alert Slack #urgent; everything else gets logged in the Inbox sheet.",
  goals: ["Urgent emails → Slack #urgent, including the subject", "Everything else → a row in Inbox (From, Subject)"],
  trigger: "email",
  palette: ["trigger.email", "ai.classify", "logic.ifElse", "logic.filter", "action.slack", "action.sheetRow"],
  channels: ["#urgent", "#general"],
  sheets: { Inbox: { columns: ["From", "Subject"] } },
  tests,
  ai: { classify: Object.fromEntries(EMAILS.map((e) => [e[6], e[7]])) },
  hints: [
    "Let AI Classify read the email body with two labels, then use If/Else to split on its answer.",
    "AI Classify (text: body, labels: urgent, not urgent) → If/Else (label equals urgent) → true: Slack #urgent with {{subject}} · false: Add sheet row to Inbox.",
  ],
  reference,
  traps: [
    { name: "classified the subject", workflow: patch(reference, "ai", { field: "subject" }), shouldFail: ["t1", "t3"] },
    { name: "missing the urgent label", workflow: patch(reference, "ai", { labels: "important, not urgent" }), shouldFail: ["t1", "t3"] },
    {
      name: "keyword filter instead of AI",
      workflow: wf(
        [
          ["t", "trigger.email"],
          ["if", "logic.ifElse", { match: "all", conditions: [{ field: "subject", op: "contains", value: "urgent" }] }],
          ["alert", "action.slack", { channel: "#urgent", message: "{{subject}}" }],
          ["log", "action.sheetRow", { sheet: "Inbox", values: { From: "{{from}}", Subject: "{{subject}}" } }],
        ],
        [
          ["t", "if"],
          ["if", "alert", "true"],
          ["if", "log", "false"],
        ],
      ),
      shouldFail: ["t1", "t3", "t4"],
    },
  ],
};
