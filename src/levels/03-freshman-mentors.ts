import { patch, wf } from "@/engine/build";
import type { Level } from "@/engine/types";

const reference = wf(
  [
    ["t", "trigger.form"],
    ["f", "logic.filter", { match: "all", conditions: [{ field: "year", op: "equals", value: "Freshman" }] }],
    [
      "mail",
      "action.email",
      {
        to: "{{email}}",
        subject: "Want a mentor?",
        body: "Hi {{first_name}}, welcome to Gen AI Club! Reply to this email to get matched with an upperclassman mentor.",
      },
    ],
  ],
  [
    ["t", "f"],
    ["f", "mail", "kept"],
  ],
);

const member = (first_name: string, email: string, year: string, major: string) => ({ first_name, email, year, major });

export const level: Level = {
  id: 3,
  slug: "freshman-mentors",
  title: "Freshman Mentors",
  tier: "medium",
  points: 200,
  skill: "Filters",
  skillHow: "A Filter only lets an item continue when its condition is true. Anything that fails just stops there.",
  task: "When a new member signs up, email only freshmen an invite to the mentor program, greeting them by first name.",
  goals: ["Only freshmen get the email", "The email goes to the person who signed up", "It greets them by first name"],
  trigger: "form",
  palette: ["trigger.form", "logic.filter", "action.email", "action.slack"],
  form: { title: "New member sign-up", fields: ["first_name", "email", "year", "major"] },
  channels: ["#general"],
  sheets: {},
  tests: [
    {
      id: "t1",
      label: "A freshman signs up",
      hidden: false,
      input: { events: [member("Ava", "achen@iu.edu", "Freshman", "Finance")] },
      expect: { emails: [{ to: "achen@iu.edu", bodyIncludes: ["Ava"] }] },
    },
    {
      id: "t2",
      label: "A junior signs up",
      hidden: false,
      input: { events: [member("Leo", "lbrooks@iu.edu", "Junior", "Informatics")] },
      expect: {},
      failHint: "Juniors aren't freshmen, so they shouldn't get the mentor email.",
    },
    {
      id: "t3",
      label: "Another freshman",
      hidden: true,
      input: { events: [member("Priya", "pshah@iu.edu", "Freshman", "Business Analytics")] },
      expect: { emails: [{ to: "pshah@iu.edu", bodyIncludes: ["Priya"] }] },
      failHint: "Is the name typed in by hand instead of coming from the form?",
    },
    {
      id: "t4",
      label: "A sophomore signs up",
      hidden: true,
      input: { events: [member("Sam", "sortiz@iu.edu", "Sophomore", "Finance")] },
      expect: {},
    },
  ],
  ai: {},
  hints: [
    "Put a Filter between the form and the email. What should the condition check?",
    "Filter: year · equals · Freshman → Send email to {{email}} with {{first_name}} in the body.",
  ],
  reference,
  traps: [
    {
      name: "no filter",
      workflow: wf(
        [
          ["t", "trigger.form"],
          ["mail", "action.email", { to: "{{email}}", subject: "Mentor", body: "Hi {{first_name}}" }],
        ],
        [["t", "mail"]],
      ),
      shouldFail: ["t2", "t4"],
    },
    { name: "hardcoded name", workflow: patch(reference, "mail", { body: "Hi Ava, want a mentor?" }), shouldFail: ["t3"] },
    {
      name: "filtered on the wrong field",
      workflow: patch(reference, "f", { conditions: [{ field: "major", op: "equals", value: "Finance" }] }),
      shouldFail: ["t3", "t4"],
    },
  ],
};
