import { patch, wf } from "@/engine/build";
import type { Level } from "@/engine/types";

const reference = wf(
  [
    ["t", "trigger.form"],
    ["row", "action.sheetRow", { sheet: "RSVPs", values: { Name: "{{name}}", Email: "{{email}}", Year: "{{year}}" } }],
  ],
  [["t", "row"]],
);

const rsvp = (name: string, email: string, year: string, dietary = "None") => ({ name, email, year, dietary });

export const level: Level = {
  id: 1,
  slug: "club-rsvp",
  title: "Club RSVP",
  tier: "easy",
  points: 100,
  skill: "Triggers & actions",
  scenario: "People RSVP to Gen AI Club meetings with a form. Right now an officer copies every answer into a spreadsheet by hand.",
  task: "Make every RSVP land in the RSVPs sheet automatically.",
  goals: ["Start the workflow when the RSVP form is submitted", "Add a row to the RSVPs sheet", "Fill Name, Email and Year with the person's answers"],
  trigger: "form",
  palette: ["trigger.form", "trigger.email", "action.sheetRow", "action.slack"],
  form: { title: "Meeting RSVP", fields: ["name", "email", "year", "dietary"] },
  channels: ["#general"],
  sheets: { RSVPs: { columns: ["Name", "Email", "Year"] } },
  tests: [
    {
      id: "t1",
      label: "Maya RSVPs",
      hidden: false,
      input: { events: [rsvp("Maya Patel", "mpatel@iu.edu", "Sophomore")] },
      expect: { rows: [{ sheet: "RSVPs", match: { Name: "Maya Patel", Email: "mpatel@iu.edu", Year: "Sophomore" } }] },
    },
    {
      id: "t2",
      label: "Jordan RSVPs",
      hidden: false,
      input: { events: [rsvp("Jordan Lee", "jlee@iu.edu", "Junior", "Vegetarian")] },
      expect: { rows: [{ sheet: "RSVPs", match: { Name: "Jordan Lee", Email: "jlee@iu.edu", Year: "Junior" } }] },
    },
    {
      id: "t3",
      label: "A third RSVP",
      hidden: true,
      input: { events: [rsvp("Sam Ortiz", "sortiz@iu.edu", "Freshman")] },
      expect: { rows: [{ sheet: "RSVPs", match: { Name: "Sam Ortiz", Email: "sortiz@iu.edu", Year: "Freshman" } }] },
      failHint: "The workflow has to work for anyone who RSVPs, not just the examples.",
    },
  ],
  ai: {},
  hints: [
    "Which event starts this: an email arriving, or a form being submitted?",
    "Form submitted → Add sheet row. In the row, click the field chips so Name gets {{name}}, Email gets {{email}}, Year gets {{year}}.",
  ],
  reference,
  traps: [
    { name: "typed a literal name", workflow: patch(reference, "row", { values: { Name: "Maya Patel", Email: "{{email}}", Year: "{{year}}" } }), shouldFail: ["t2", "t3"] },
    { name: "swapped name and email", workflow: patch(reference, "row", { values: { Name: "{{email}}", Email: "{{name}}", Year: "{{year}}" } }), shouldFail: ["t1", "t2", "t3"] },
    {
      name: "wrong trigger",
      workflow: wf(
        [
          ["t", "trigger.email"],
          ["row", "action.sheetRow", { sheet: "RSVPs", values: { Name: "{{from_name}}", Email: "{{from}}", Year: "" } }],
        ],
        [["t", "row"]],
      ),
      shouldFail: ["t1", "t2", "t3"],
    },
  ],
};
