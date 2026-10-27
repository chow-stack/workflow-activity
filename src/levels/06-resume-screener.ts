import { patch, wf } from "@/engine/build";
import type { Level, Scalar, TestCase } from "@/engine/types";

const reference = wf(
  [
    ["t", "trigger.form"],
    [
      "x",
      "ai.extract",
      {
        field: "resume_text",
        fields: [
          { name: "gpa", type: "number" },
          { name: "major", type: "text" },
          { name: "skills", type: "list" },
        ],
      },
    ],
    ["row", "action.sheetRow", { sheet: "Applicants", values: { Name: "{{name}}", Email: "{{email}}", GPA: "{{gpa}}", Major: "{{major}}" } }],
    [
      "f",
      "logic.filter",
      {
        match: "all",
        conditions: [
          { field: "gpa", op: "gte", value: "3.3" },
          { field: "skills", op: "contains", value: "Excel" },
        ],
      },
    ],
    [
      "invite",
      "action.email",
      { to: "{{email}}", subject: "Interview invitation", body: "Hi {{name}}, we'd love to interview you for the analyst role. Pick a time that works for you." },
    ],
  ],
  [
    ["t", "x"],
    ["x", "row"],
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
  gpa: Scalar;
  gpaValue: number;
  major: string;
  skills: string[];
  invite: boolean;
}

const APPLICANTS: Applicant[] = [
  {
    id: "t1", label: "Strong finance applicant", hidden: false, name: "Ava Thompson", email: "athompson@iu.edu",
    resume: "Ava Thompson. Kelley School of Business, B.S. Finance, GPA 3.7. Skills: Excel, PowerPoint, financial modeling. Interned at a regional bank.",
    gpa: 3.7, gpaValue: 3.7, major: "Finance", skills: ["Excel", "PowerPoint", "Financial modeling"], invite: true,
  },
  {
    id: "t2", label: "Knows Excel, GPA below the bar", hidden: false, name: "Ethan Brooks", email: "ebrooks@iu.edu",
    resume: "Ethan Brooks. Accounting major, 3.2 GPA. Comfortable with Excel and QuickBooks. Treasurer of the investment club.",
    gpa: 3.2, gpaValue: 3.2, major: "Accounting", skills: ["Excel", "QuickBooks"], invite: false,
  },
  {
    id: "t3", label: "High GPA, no Excel", hidden: false, name: "Lily Nguyen", email: "lnguyen@iu.edu",
    resume: "Lily Nguyen | Informatics | GPA 3.8 | Python, SQL, Tableau | Built a course-planning app.",
    gpa: 3.8, gpaValue: 3.8, major: "Informatics", skills: ["Python", "SQL", "Tableau"], invite: false,
  },
  {
    id: "t4", label: "GPA written a different way", hidden: true, name: "Noah Patel", email: "npatel@iu.edu",
    resume: "Noah Patel. Business Analytics, GPA: 3.45/4.0. Advanced Excel modeling, R, and Power BI. Case competition finalist.",
    gpa: "3.45/4.0", gpaValue: 3.45, major: "Business Analytics", skills: ["Advanced Excel modeling", "R", "Power BI"], invite: true,
  },
  {
    id: "t5", label: "Right on the line", hidden: true, name: "Grace Miller", email: "gmiller@iu.edu",
    resume: "Grace Miller, Finance. GPA 3.3. Tools: Excel, Bloomberg Terminal. Pitched for the student-managed fund.",
    gpa: 3.3, gpaValue: 3.3, major: "Finance", skills: ["Excel", "Bloomberg Terminal"], invite: true,
  },
];

const tests: TestCase[] = APPLICANTS.map((a) => ({
  id: a.id,
  label: a.label,
  hidden: a.hidden,
  input: { events: [{ name: a.name, email: a.email, resume_text: a.resume }] },
  expect: {
    rows: [{ sheet: "Applicants", match: { Name: a.name, Email: a.email, GPA: a.gpaValue, Major: a.major } }],
    emails: a.invite ? [{ to: a.email, bodyIncludes: [a.name.split(" ")[0]] }] : [],
  },
  failHint:
    a.id === "t4"
      ? "This GPA is written “3.45/4.0”. Is the AI giving you a number, or text?"
      : a.id === "t5"
        ? "A 3.3 GPA counts. Check “greater than” vs “greater than or equal”."
        : a.invite
          ? undefined
          : "Every applicant gets logged, but only GPA ≥ 3.3 AND Excel gets an invite.",
}));

export const level: Level = {
  id: 6,
  slug: "resume-screener",
  title: "Resume Screener",
  tier: "hard",
  points: 300,
  skill: "AI: extract",
  scenario: "You're screening analyst applications. Every resume is written differently, so the facts you need are buried in the text.",
  task: "Log every applicant, and invite the strong ones to interview.",
  goals: ["Every applicant → row in Applicants (Name, Email, GPA, Major)", "GPA 3.3 or higher AND lists Excel → interview invite email"],
  trigger: "form",
  palette: ["trigger.form", "ai.extract", "ai.classify", "logic.filter", "logic.ifElse", "action.sheetRow", "action.email"],
  form: { title: "Analyst application", fields: ["name", "email", "resume_text"] },
  channels: ["#general"],
  sheets: { Applicants: { columns: ["Name", "Email", "GPA", "Major"] } },
  tests,
  ai: {
    extract: Object.fromEntries(
      APPLICANTS.map((a) => [a.resume, { name: a.name, gpa: a.gpa, major: a.major, skills: a.skills }]),
    ),
  },
  hints: [
    "Pull the GPA, major and skills out of the resume first, then decide who gets an invite.",
    "AI Extract (gpa as number, major as text, skills as list) → connect it to BOTH Add sheet row and a Filter (gpa ≥ 3.3 AND skills contains Excel) → Send email.",
  ],
  reference,
  traps: [
    {
      name: "greater than instead of ≥",
      workflow: patch(reference, "f", {
        conditions: [
          { field: "gpa", op: "gt", value: "3.3" },
          { field: "skills", op: "contains", value: "Excel" },
        ],
      }),
      shouldFail: ["t5"],
    },
    {
      name: "gpa extracted as text",
      workflow: patch(reference, "x", {
        fields: [
          { name: "gpa", type: "text" },
          { name: "major", type: "text" },
          { name: "skills", type: "list" },
        ],
      }),
      shouldFail: ["t4"],
    },
    {
      name: "filter before logging",
      workflow: {
        ...reference,
        edges: reference.edges.filter((e) => !(e.source === "x" && e.target === "row")).concat({ id: "e-f-row", source: "f", sourceHandle: "kept", target: "row" }),
      },
      shouldFail: ["t2", "t3"],
    },
    {
      name: "only checks the resume for Excel",
      workflow: patch(reference, "f", { conditions: [{ field: "resume_text", op: "contains", value: "Excel" }] }),
      shouldFail: ["t2"],
    },
  ],
};
