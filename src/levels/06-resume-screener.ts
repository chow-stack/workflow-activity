import { patch, wf } from "@/engine/build";
import type { Level, Scalar, TestCase } from "@/engine/types";

const reference = wf(
  [
    ["t", "trigger.form"],
    ["x", "ai.extract", { field: "resume_text", fields: [{ name: "gpa", type: "number" }] }],
    ["f", "logic.filter", { match: "all", conditions: [{ field: "gpa", op: "gte", value: "3.3" }] }],
    [
      "invite",
      "action.email",
      { to: "{{email}}", subject: "Interview invitation", body: "Hi {{name}}, we'd love to interview you for the analyst role." },
    ],
  ],
  [
    ["t", "x"],
    ["x", "f"],
    ["f", "invite", "kept"],
  ],
);

interface Applicant {
  id: string;
  label: string;
  hidden: boolean;
  name: string;
  email: string;
  resume: string;
  gpa: Scalar; // what the AI "reads" from the resume
  invite: boolean;
}

const APPLICANTS: Applicant[] = [
  {
    id: "t1", label: "GPA 3.7", hidden: false, name: "Ava Thompson", email: "athompson@iu.edu",
    resume: "Ava Thompson. Kelley School of Business, B.S. Finance, GPA 3.7. Skills: Excel, PowerPoint. Interned at a regional bank.",
    gpa: 3.7, invite: true,
  },
  {
    id: "t2", label: "GPA 3.2", hidden: false, name: "Ethan Brooks", email: "ebrooks@iu.edu",
    resume: "Ethan Brooks. Accounting major, 3.2 GPA. Comfortable with Excel and QuickBooks. Treasurer of the investment club.",
    gpa: 3.2, invite: false,
  },
  {
    id: "t3", label: "GPA written a different way", hidden: true, name: "Noah Patel", email: "npatel@iu.edu",
    resume: "Noah Patel. Business Analytics, GPA: 3.45/4.0. Advanced Excel modeling, R, and Power BI.",
    gpa: "3.45/4.0", invite: true,
  },
  {
    id: "t4", label: "Right on the line", hidden: true, name: "Grace Miller", email: "gmiller@iu.edu",
    resume: "Grace Miller, Finance. GPA 3.3. Tools: Excel, Bloomberg Terminal. Pitched for the student-managed fund.",
    gpa: 3.3, invite: true,
  },
];

const tests: TestCase[] = APPLICANTS.map((a) => ({
  id: a.id,
  label: a.label,
  hidden: a.hidden,
  input: { events: [{ name: a.name, email: a.email, resume_text: a.resume }] },
  expect: { emails: a.invite ? [{ to: a.email, bodyIncludes: [a.name.split(" ")[0]] }] : [] },
  failHint:
    a.id === "t3"
      ? "This GPA is written “3.45/4.0”. Did you set the extracted gpa's type to number?"
      : a.id === "t4"
        ? "A 3.3 GPA counts. Check “is greater than” vs “is at least”."
        : a.invite
          ? undefined
          : "Only GPAs of 3.3 or higher get an invite.",
}));

export const level: Level = {
  id: 6,
  slug: "resume-screener",
  title: "Resume Screener",
  tier: "hard",
  points: 300,
  skill: "AI Extract",
  skillHow: "AI Extract pulls one fact out of messy text and saves it as a new field. Set its type to number if you want to compare it.",
  task: "Read each resume, find the GPA, and email an interview invite to everyone with a GPA of 3.3 or higher.",
  goals: ["Extract the GPA from the resume as a number", "GPA 3.3 or higher → interview invite to the applicant", "Lower GPAs get nothing"],
  trigger: "form",
  palette: ["trigger.form", "ai.extract", "ai.classify", "logic.filter", "logic.ifElse", "action.email", "action.sheetRow"],
  form: { title: "Analyst application", fields: ["name", "email", "resume_text"] },
  channels: ["#general"],
  sheets: { Applicants: { columns: ["Name", "Email", "GPA"] } },
  tests,
  ai: { extract: Object.fromEntries(APPLICANTS.map((a) => [a.resume, { name: a.name, gpa: a.gpa }])) },
  hints: [
    "The GPA is buried in the resume text. Pull it out first, then decide who gets an invite.",
    "AI Extract (read resume_text, fact: gpa as number) → Filter gpa · is at least · 3.3 → Send email to {{email}}.",
  ],
  reference,
  traps: [
    {
      name: "greater than instead of at least",
      workflow: patch(reference, "f", { conditions: [{ field: "gpa", op: "gt", value: "3.3" }] }),
      shouldFail: ["t4"],
    },
    { name: "gpa extracted as text", workflow: patch(reference, "x", { fields: [{ name: "gpa", type: "text" }] }), shouldFail: ["t3"] },
    {
      name: "no filter",
      workflow: {
        ...reference,
        nodes: reference.nodes.filter((n) => n.id !== "f"),
        edges: reference.edges
          .filter((e) => e.source !== "f" && e.target !== "f")
          .concat({ id: "e-x-invite", source: "x", sourceHandle: "out", target: "invite" }),
      },
      shouldFail: ["t2"],
    },
  ],
};
