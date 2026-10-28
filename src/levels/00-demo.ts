import { patch, wf } from "@/engine/build";
import type { Level } from "@/engine/types";

// The guided warm-up the host walks through on the big screen. Worth no points.

const reference = wf(
  [
    ["t", "trigger.form"],
    ["msg", "action.slack", { channel: "#general", message: "Someone new just joined Gen AI Club!" }],
  ],
  [["t", "msg"]],
);

const signup = (name: string, email: string) => ({ name, email });

export const level: Level = {
  id: 0,
  slug: "first-workflow",
  title: "Your First Workflow",
  tier: "demo",
  points: 0,
  skill: "Triggers and actions",
  skillHow: "Every workflow starts with a trigger (the event that kicks it off) and then does one or more actions.",
  task: "When someone signs up for Gen AI Club, post a message in #general.",
  goals: ["Start with the Form submitted trigger", "Add a Slack message step in #general", "Write any message, then press Run tests"],
  trigger: "form",
  palette: ["trigger.form", "trigger.email", "action.slack", "action.email"],
  form: { title: "Club sign-up", fields: ["name", "email"] },
  channels: ["#general", "#random"],
  sheets: {},
  tests: [
    {
      id: "t1",
      label: "Maya signs up",
      hidden: false,
      input: { events: [signup("Maya Patel", "mpatel@iu.edu")] },
      expect: { slack: [{ channel: "#general" }] },
    },
    {
      id: "t2",
      label: "Jordan signs up",
      hidden: false,
      input: { events: [signup("Jordan Lee", "jlee@iu.edu")] },
      expect: { slack: [{ channel: "#general" }] },
    },
  ],
  ai: {},
  hints: [
    "The sign-up form starts this, so the trigger is Form submitted.",
    "Form submitted → Slack message. Pick #general and type any message.",
  ],
  reference,
  traps: [
    { name: "wrong channel", workflow: patch(reference, "msg", { channel: "#random" }), shouldFail: ["t1", "t2"] },
    {
      name: "wrong trigger",
      workflow: wf(
        [
          ["t", "trigger.email"],
          ["msg", "action.slack", { channel: "#general", message: "hi" }],
        ],
        [["t", "msg"]],
      ),
      shouldFail: ["t1", "t2"],
    },
  ],
};
