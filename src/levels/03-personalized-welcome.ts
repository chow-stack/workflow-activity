import { patch, wf } from "@/engine/build";
import type { Level } from "@/engine/types";

const reference = wf(
  [
    ["t", "trigger.form"],
    [
      "mail",
      "action.email",
      {
        to: "{{email}}",
        subject: "Welcome to Gen AI Club!",
        body: "Hi {{first_name}}, welcome to Gen AI Club! It's great to have a {{major}} major with us.",
      },
    ],
  ],
  [["t", "mail"]],
);

const member = (first_name: string, last_name: string, email: string, major: string) => ({
  first_name,
  last_name,
  email,
  major,
});

export const level: Level = {
  id: 3,
  slug: "personalized-welcome",
  title: "Personalized Welcome",
  tier: "medium",
  points: 200,
  teaches: "Mapping data: the same workflow writes a different message for every person.",
  brief:
    "New members fill out a sign-up form. Send each one a welcome email that greets them by first name and mentions their major.",
  goals: ["Email goes to the person who signed up", "Greets them by first name", "Mentions their major"],
  trigger: "form",
  palette: ["trigger.form", "action.email", "action.slack", "action.sheetRow"],
  form: { title: "New member sign-up", fields: ["first_name", "last_name", "email", "major"] },
  channels: ["#general"],
  sheets: { Members: { columns: ["Name", "Email"] } },
  tests: [
    {
      id: "t1",
      label: "Ava signs up",
      hidden: false,
      input: { events: [member("Ava", "Chen", "achen@iu.edu", "Finance")] },
      expect: { emails: [{ to: "achen@iu.edu", bodyIncludes: ["Ava", "Finance"] }] },
    },
    {
      id: "t2",
      label: "Leo signs up",
      hidden: false,
      input: { events: [member("Leo", "Brooks", "lbrooks@iu.edu", "Informatics")] },
      expect: { emails: [{ to: "lbrooks@iu.edu", bodyIncludes: ["Leo", "Informatics"] }] },
    },
    {
      id: "t3",
      label: "A double major signs up",
      hidden: true,
      input: { events: [member("Priya", "Shah", "pshah@iu.edu", "Finance + Business Analytics")] },
      expect: { emails: [{ to: "pshah@iu.edu", bodyIncludes: ["Priya", "Finance + Business Analytics"] }] },
      failHint: "Is anything in your email typed in by hand instead of coming from the form?",
    },
  ],
  ai: {},
  hints: [
    "The email changes for every person. Where does each person's info come from?",
    "In Send email, use {{email}} for To, and put {{first_name}} and {{major}} in the body.",
  ],
  reference,
  traps: [
    {
      name: "hardcoded greeting",
      workflow: patch(reference, "mail", { body: "Hi Ava, welcome! Great to have a Finance major with us." }),
      shouldFail: ["t2", "t3"],
    },
    {
      name: "last name instead of first",
      workflow: patch(reference, "mail", { body: "Hi {{last_name}}, welcome! Great to have a {{major}} major." }),
      shouldFail: ["t1", "t2", "t3"],
    },
    { name: "literal recipient", workflow: patch(reference, "mail", { to: "achen@iu.edu" }), shouldFail: ["t2", "t3"] },
  ],
};
