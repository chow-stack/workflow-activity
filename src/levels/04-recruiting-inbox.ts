import { patch, wf } from "@/engine/build";
import type { Level, TestCase } from "@/engine/types";

const FIRMS = "goldmansachs.com, jpmorgan.com, mckinsey.com";

const reference = wf(
  [
    ["t", "trigger.email"],
    ["f", "logic.filter", { match: "all", conditions: [{ field: "from", op: "endsWithAny", value: FIRMS }] }],
    ["msg", "action.slack", { channel: "#recruiting", message: "{{from_name}}: {{subject}}" }],
  ],
  [
    ["t", "f"],
    ["f", "msg", "kept"],
  ],
);

const email = (from: string, from_name: string, subject: string, body: string) => ({ from, from_name, subject, body });

const test = (
  id: string,
  label: string,
  hidden: boolean,
  e: ReturnType<typeof email>,
  posts: boolean,
  failHint?: string,
): TestCase => ({
  id,
  label,
  hidden,
  input: { events: [e] },
  expect: posts ? { slack: [{ channel: "#recruiting", includes: [e.subject] }] } : {},
  failHint,
});

const LOOKALIKE = "A lookalike domain reached #recruiting. Check exactly how the sender address ends.";

export const level: Level = {
  id: 4,
  slug: "recruiting-inbox",
  title: "Recruiting Inbox",
  tier: "medium",
  points: 200,
  teaches: "Filters and edge cases: deciding what gets through.",
  brief:
    "Your inbox is flooded. Only emails from these firms should be posted to Slack #recruiting, with the subject line: goldmansachs.com, jpmorgan.com, mckinsey.com. Everything else stays out.",
  goals: ["Firm emails post to #recruiting", "The message includes the subject", "Nothing else gets posted"],
  trigger: "email",
  palette: ["trigger.email", "logic.filter", "logic.ifElse", "action.slack", "action.email"],
  channels: ["#recruiting", "#general"],
  sheets: {},
  tests: [
    test("t1", "Goldman Superday", false, email("recruiting@goldmansachs.com", "Goldman Sachs Campus Recruiting", "Superday invitation", "We'd like to invite you to our Superday on Nov 14."), true),
    test("t2", "J.P. Morgan coffee chat", false, email("campus@jpmorgan.com", "J.P. Morgan Campus", "Coffee chat next week", "Are you free for a quick coffee chat?"), true),
    test("t3", "Kelley newsletter", false, email("news@iu.edu", "Kelley School of Business", "Kelley weekly digest", "This week at Kelley…"), false),
    test("t4", "McKinsey prep session", true, email("talent@mckinsey.com", "McKinsey & Company", "Case interview prep session", "Join our virtual case prep."), true),
    test("t5", "Lookalike Goldman domain", true, email("careers@goldman-sachs-jobs.net", "Goldman Careers", "URGENT: claim your offer", "Click here to claim your offer letter now."), false, LOOKALIKE),
    test("t6", "Sneaky J.P. Morgan domain", true, email("promo@jpmorgan.com.deals.biz", "JPM Deals", "You've been selected", "Congratulations, you've been selected!"), false, LOOKALIKE),
  ],
  ai: {},
  hints: [
    "Look at the end of the sender address, not just whether it mentions the firm.",
    "Filter: from · ends with any of · goldmansachs.com, jpmorgan.com, mckinsey.com → Slack #recruiting with {{subject}}.",
  ],
  reference,
  traps: [
    {
      name: "contains goldman",
      workflow: patch(reference, "f", { conditions: [{ field: "from", op: "contains", value: "goldman" }] }),
      shouldFail: ["t2", "t4", "t5"],
    },
    {
      name: "contains firm domains",
      workflow: patch(reference, "f", {
        match: "any",
        conditions: FIRMS.split(", ").map((d) => ({ field: "from", op: "contains", value: d })),
      }),
      shouldFail: ["t6"],
    },
    {
      name: "no filter",
      workflow: wf(
        [
          ["t", "trigger.email"],
          ["msg", "action.slack", { channel: "#recruiting", message: "{{subject}}" }],
        ],
        [["t", "msg"]],
      ),
      shouldFail: ["t3", "t5", "t6"],
    },
  ],
};
