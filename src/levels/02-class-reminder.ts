import { patch, wf } from "@/engine/build";
import type { Level } from "@/engine/types";

const reference = wf(
  [
    ["t", "trigger.schedule", { frequency: "week", weekday: 1, time: "08:00" }],
    ["msg", "action.slack", { channel: "#c204-study", message: "C204 quiz today" }],
  ],
  [["t", "msg"]],
);

export const level: Level = {
  id: 2,
  slug: "class-reminder",
  title: "Class Reminder",
  tier: "easy",
  points: 100,
  skill: "Schedules",
  skillHow: "A Schedule trigger starts the workflow at set times instead of when something happens.",
  task: "Post “C204 quiz today” in Slack #c204-study every Monday at 8:00 AM.",
  goals: ["Run once a week: Monday at 8:00 AM", "Post the reminder in #c204-study"],
  trigger: "schedule",
  palette: ["trigger.schedule", "trigger.form", "action.slack", "action.email"],
  form: { title: "Study group sign-up", fields: ["name", "email"] },
  channels: ["#c204-study", "#general"],
  sheets: {},
  tests: [
    {
      id: "t1",
      label: "One simulated week (Sun → Sat)",
      hidden: false,
      input: { window: { startWeekday: 0, days: 7 } },
      expect: { slack: [{ channel: "#c204-study", includes: ["quiz"], at: "Mon 08:00" }] },
    },
  ],
  ai: {},
  hints: [
    "How often should this run: every day, or every week?",
    "Schedule → every week → Monday → 08:00, then a Slack message in #c204-study.",
  ],
  reference,
  traps: [
    { name: "every day", workflow: patch(reference, "t", { frequency: "day" }), shouldFail: ["t1"] },
    { name: "every hour", workflow: patch(reference, "t", { frequency: "hour" }), shouldFail: ["t1"] },
    { name: "wrong weekday", workflow: patch(reference, "t", { weekday: 2 }), shouldFail: ["t1"] },
    { name: "wrong time", workflow: patch(reference, "t", { time: "09:00" }), shouldFail: ["t1"] },
    { name: "wrong channel", workflow: patch(reference, "msg", { channel: "#general" }), shouldFail: ["t1"] },
  ],
};
