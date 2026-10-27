import { patch, wf } from "@/engine/build";
import type { Expect, Level, TestCase } from "@/engine/types";

const reference = wf(
  [
    ["t", "trigger.form"],
    ["ai", "ai.classify", { field: "review_text", labels: "positive, negative, question", output: "label" }],
    ["sw", "logic.switch", { field: "label", rules: ["positive", "negative", "question"] }],
    ["row", "action.sheetRow", { sheet: "Testimonials", values: { Reviewer: "{{reviewer}}", Review: "{{review_text}}" } }],
    ["alert", "action.slack", { channel: "#customer-care", message: "Unhappy customer: {{reviewer}} said “{{review_text}}”" }],
    [
      "reply",
      "action.email",
      { to: "{{email}}", subject: "Thanks for your question!", body: "Hi {{reviewer}}, thanks for asking! We'll get back to you within a day." },
    ],
  ],
  [
    ["t", "ai"],
    ["ai", "sw"],
    ["sw", "row", "r0"],
    ["sw", "alert", "r1"],
    ["sw", "reply", "r2"],
  ],
);

type Kind = "positive" | "negative" | "question";
const REVIEWS: [id: string, label: string, hidden: boolean, reviewer: string, email: string, text: string, kind: Kind][] = [
  ["t1", "A happy regular", false, "Nina Alvarez", "nalvarez@iu.edu", "Best cold brew on campus, and the staff remember my order.", "positive"],
  ["t2", "A slow morning", false, "Marcus Hill", "mhill@iu.edu", "My latte was cold and the line took 25 minutes.", "negative"],
  ["t3", "A customer with a question", false, "Tara Singh", "tsingh@iu.edu", "Do you have oat milk, and are you open on Sundays?", "question"],
  ["t4", "Read this one carefully", true, "Ben Ortiz", "bortiz@iu.edu", "Great, waited 40 minutes for a muffin. Love that for me.", "negative"],
  ["t5", "Another happy customer", true, "Chloe Kim", "ckim@iu.edu", "Super cozy spot for studying, love the playlist.", "positive"],
  ["t6", "Another question", true, "Omar Haddad", "ohaddad@iu.edu", "Is the student discount still 10%?", "question"],
];

const expectFor = (kind: Kind, reviewer: string, email: string): Expect =>
  kind === "positive"
    ? { rows: [{ sheet: "Testimonials", match: { Reviewer: reviewer } }] }
    : kind === "negative"
      ? { slack: [{ channel: "#customer-care", includes: [reviewer] }] }
      : { emails: [{ to: email }] };

const tests: TestCase[] = REVIEWS.map(([id, label, hidden, reviewer, email, review_text, kind]) => ({
  id,
  label,
  hidden,
  input: { events: [{ reviewer, email, review_text }] },
  expect: expectFor(kind, reviewer, email),
  failHint:
    id === "t4"
      ? "This one sounds positive at first, but it's sarcastic. What did the AI label it, and where did that label send it?"
      : kind === "question"
        ? "Questions should get an email reply. Can the AI even answer “question”?"
        : undefined,
}));

export const level: Level = {
  id: 5,
  slug: "review-router",
  title: "Review Router",
  tier: "hard",
  points: 300,
  teaches: "AI classification: turn messy text into a label, then route on it.",
  brief:
    "Hoosier Bean, a campus coffee shop, collects reviews through a form. Positive reviews go into the Testimonials sheet. Negative reviews alert #customer-care in Slack. Questions get an email reply to the reviewer.",
  goals: ["Positive → row in Testimonials", "Negative → Slack #customer-care (include the reviewer)", "Question → email reply to the reviewer"],
  trigger: "form",
  palette: ["trigger.form", "ai.classify", "logic.switch", "logic.ifElse", "action.sheetRow", "action.slack", "action.email"],
  form: { title: "Hoosier Bean review", fields: ["reviewer", "email", "review_text"] },
  channels: ["#customer-care", "#general"],
  sheets: { Testimonials: { columns: ["Reviewer", "Review"] } },
  tests,
  ai: { classify: Object.fromEntries(REVIEWS.map((r) => [r[5], r[6]])) },
  hints: [
    "The AI can only pick from the labels you give it. Are all three there?",
    "AI Classify (text: review_text, labels: positive, negative, question) → Switch on label with three rules → one action per branch.",
  ],
  reference,
  traps: [
    { name: "missing question label", workflow: patch(reference, "ai", { labels: "positive, negative" }), shouldFail: ["t3", "t6"] },
    { name: "classified the wrong field", workflow: patch(reference, "ai", { field: "reviewer" }), shouldFail: ["t1", "t2", "t3", "t4", "t5", "t6"] },
    {
      name: "if/else with two branches",
      workflow: wf(
        [
          ["t", "trigger.form"],
          ["ai", "ai.classify", { field: "review_text", labels: "positive, negative, question" }],
          ["if", "logic.ifElse", { match: "all", conditions: [{ field: "label", op: "equals", value: "positive" }] }],
          ["row", "action.sheetRow", { sheet: "Testimonials", values: { Reviewer: "{{reviewer}}", Review: "{{review_text}}" } }],
          ["alert", "action.slack", { channel: "#customer-care", message: "{{reviewer}}: {{review_text}}" }],
        ],
        [
          ["t", "ai"],
          ["ai", "if"],
          ["if", "row", "true"],
          ["if", "alert", "false"],
        ],
      ),
      shouldFail: ["t3", "t6"],
    },
  ],
};
