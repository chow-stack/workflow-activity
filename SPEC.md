# Workflow Activity — Build Spec

Gen AI Club automation meeting. Players build automation workflows on a Zapier-style canvas, run them against hidden test cases, and climb a live leaderboard. Eight graded levels.

Status: v3 · 2026-10-27 (rooms with join codes, guided demo, re-paced levels, clearer results; v2: no boss round or passcode, Zapier-style light design)

---

## 1. Decisions (locked)

| Topic | Decision |
|---|---|
| Format | ~10 min talk → ~35–40 min graded levels → wrap-up |
| Players | **Solo:** each person joins with their own name on their own laptop (pairs can share one name if someone has no laptop). No accounts. Internally a player is still a row in `teams`. |
| AI | **Fully simulated.** No live model calls, no API keys. AI blocks return fixed answers per test input. |
| Grading | By **output**, not by graph shape. Any workflow that produces the right Slack messages / emails / sheet rows passes. |
| Execution | Entirely client-side (browser). |
| Backend | None beyond Supabase for teams, completions, session state, and the realtime leaderboard. |
| Hosting | Vercel |
| Devices | Laptop only (≥1280px wide). Below 1024px show a "use a laptop" screen. |
| Design | Zapier's design system (light only, paper-thin surfaces, hairline borders, pill buttons, Inter + wide display face) using genaiiu.com's logo and colors (crimson, cream, warm brown ink). |

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) + TypeScript |
| Canvas | React Flow (`@xyflow/react`) |
| Styling | Tailwind CSS v4 with design tokens (§10) |
| State | Zustand (workflow, run results, UI) |
| Engine | Pure TS module in `src/engine/`, no React imports |
| Tests | Vitest (engine + every level's reference and trap solutions) |
| Data | Supabase (Postgres + Realtime), `@supabase/supabase-js` |
| Fonts | `next/font/google`: Inter (UI), Bricolage Grotesque (display, stands in for Zapier's Degular), JetBrains Mono (field names) |
| Icons | lucide-react |

---

## 3. Routes

| Route | Who | Purpose |
|---|---|---|
| `/` | Player | Kahoot-style join: room code → name. `/?room=CODE` prefills the code |
| `/play` | Player | Demo or levels for the room they joined |
| `/host` | Host | Create a room (gets a code + secret host key on that laptop), then run it: Lobby → Demo → Levels → Done |
| `/board?room=CODE` | Projector | Lobby: giant code + joined names · Demo: progress · Levels: top 10 leaderboard |
| `/demo` | Host | The warm-up level, local only, for presenting the walkthrough. Nothing is recorded |
| `/solutions?room=CODE` | Host | After the session ends: each level's solution (auto-laid-out canvas), step-by-step explanation with settings, and the common mistakes the tests caught. Locked until the room is `ended` |

### 3.1 Room phases

| Phase | Player screen | Board |
|---|---|---|
| `lobby` | "You're in" + look at the big screen | Join URL, code, names |
| `demo` | Warm-up level (level 0). After passing: "Level 1 opens when the host starts the clock" | Demo title, task, `done/total` bar, names turn green |
| `running` | Levels 1–8, countdown, hint button, rank | Leaderboard + countdown |
| `paused` | Covered | Leaderboard, paused clock |
| `ended` | Final score + rank | Top-3 podium → "Full standings" (rank, levels as dots, completed x/8, points) and "Walk through the solutions" |

## 4. Player flow

1. Enter the room code (validated against `rooms`; ended rooms are refused), then a name. Names are unique per room (case-insensitive).
2. If the name is taken: "Add your last initial, or **continue as “Name”**" (rejoins that player, e.g. after switching laptops; completed levels come back from `completions`).
3. `localStorage`: `wl.player` = `{ id, name, room }`; `wl.progress.<id>` = current level, workflows per level, hints, done, intros seen.
4. Players who join after the demo skip it. Levels unlock in order; skipping (after both hints) gives 0 points.

## 5. Data model (Supabase)

- `rooms(code pk, phase, ends_at, paused_remaining_s)`: public read. Codes are 5 characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`.
- `room_keys(code, host_key)`: no client access at all; only the functions below read it.
- `teams(id, name, room_code)`: one row per player. Unique `(room_code, lower(name))`.
- `completions(team_id, room_code, level 0–8, points, hints_used, skipped)`: level 0 = demo (no points). Inserts allowed for level 0 during `demo`/`running`, levels 1–8 only during `running`.
- `create_room()` → `{ code, host_key }`. `host_room(code, host_key, action, minutes)`: `demo`, `start`, `pause`, `resume`, `add_time`, `end`, `lobby`, `reset`. Wrong key → error.
- Realtime on `rooms`, `teams`, `completions`, filtered by room code.
- Migrations: `0001`–`0004` are all applied (2026-10-27). `0003` added rooms; `0004` dropped the old singleton `session` and made `room_code` required.

**Env vars:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (public by design, must be set before the Vercel build).

## 6. Scoring

| Tier | Levels | Points each |
|---|---|---|
| Easy | 1–2 | 100 |
| Medium | 3–4 | 200 |
| Hard | 5–6 | 300 |
| Expert | 7–8 | 400 |

- Max 2000.
- Each hint used: −25% of that level's points (2 hints max → 50% floor).
- Skip: 0.
- Leaderboard order: points desc → levels cleared desc → time of latest completion asc.

---

## 7. Workflow model

### 7.1 Items
Data flows as **items**: flat JSON objects (`Record<string, string | number | boolean | string[] | null>`). Every node passes the incoming item through and **adds** its output fields. Actions pass items through unchanged, so they can be chained.

### 7.2 Graph rules
- Exactly one trigger node; it has no input.
- Directed acyclic. Connecting an edge that creates a cycle is rejected in the UI.
- One input handle per non-trigger node; multiple incoming edges are concatenated.
- Fan-out allowed: one output handle can connect to several nodes (each receives the same items).
- Nodes not reachable from the trigger show a "not connected" warning and are skipped.

### 7.3 Execution
- Topological order from the trigger. Each node runs **once per workflow run** with all items that reached its input (n8n semantics). Nodes with zero input items do not run and produce nothing.
- Actions execute once per item.
- Run cap: 500 node-item executions per test case; exceeding it fails the test with "Workflow ran too many steps."
- AI nodes add a 400ms simulated delay per node (not per item) during the animated run only; grading-only runs (unit tests) skip delays.

### 7.4 Templates and fields
- Text fields accept `{{field_name}}` tokens. Missing field → empty string + warning in the run log.
- Config inputs show available fields as clickable chips; clicking inserts the token. Tokens render as pills inside inputs.
- Available fields at a node are computed by **static propagation**: each node type declares `outputFields(config, inputFields)`. No need to run the workflow to see fields.

### 7.5 Validation before run
Blocking errors shown as red badges on nodes and listed above the Run button:
no trigger · more than one trigger · required config empty · node not connected.

---

## 8. Node catalog

Each level exposes a subset (§9). Distractor nodes are allowed.

### Triggers
| Node | Config | Emits |
|---|---|---|
| **Form submitted** | Form (fixed per level, read-only field list) | One item per submission in the test case |
| **New email** | — | One item per email: `from`, `from_name`, `subject`, `body` |
| **Schedule** | Frequency (`every hour` / `every day` / `every week`), time (HH:MM), weekday (weekly only) | One item per fire time inside the test case's simulated window: `fired_at`, `weekday`, `time` |

### Data
| Node | Config | Behavior |
|---|---|---|
| **Read sheet** | Sheet (dropdown of the level's sheets) | Replaces input with **one item** `{ rows: Row[], row_count }` |
| **For each** | List field (chip, e.g. `rows`) | Splits the list into one item per element; element's columns become fields |
| **Combine** | Mode: `collect`; optional `count`, `sum of field`, `join field as lines` | Many items → **one item**: `count`, `sum_<field>`, `lines` (newline-joined template output). Zero input → no output |

`Combine` config: "Line template" (e.g. `{{item}}: {{stock}} {{unit}} left`) used to build `lines`.

### Logic
| Node | Config | Outputs |
|---|---|---|
| **Filter** | Conditions + `all` / `any` | `kept` |
| **If / Else** | Conditions + `all` / `any` | `true`, `false` |
| **Switch** | Field + up to 5 rules (`equals` value) | One handle per rule + `fallback` |

**Condition** = field · operator · value. Value may be a literal or a field chip.

Operators: `equals`, `not equals`, `contains`, `does not contain`, `starts with`, `ends with`, `ends with any of` (comma list), `>`, `≥`, `<`, `≤`, `is empty`, `is not empty`.

Comparison rules: strings case-insensitive and trimmed; if both sides parse as numbers, compare numerically; on arrays, `contains` = any element contains the value (case-insensitive).

### AI (simulated, §8.1)
| Node | Config | Adds field(s) |
|---|---|---|
| **AI Classify** | Text to classify (field chip), Labels (comma list), Output field name (default `label`) | `label` |
| **AI Extract** | Text to read (field chip), Fields to extract (list of names + type: text / number / list) | One field per configured name |
| **AI Write** | Instructions (textarea with chips), Output field name (default `ai_text`) | `ai_text` |

### Actions
| Node | Config | Records to world |
|---|---|---|
| **Send email** | To, Subject, Body | `emails[]` |
| **Slack message** | Channel (dropdown of level channels), Message | `slack[]` |
| **Add sheet row** | Sheet (dropdown), column → value mapping (all columns shown) | Appends to `sheets[name]` |

### 8.1 Simulated AI rules
Each level supplies `aiFixtures`, keyed by the **exact source text** (trimmed). The node looks up the text it was pointed at.

- **Classify**: fixture gives the true label. Output = true label if it appears in the configured labels (case-insensitive), else `"unknown"`. Pointing it at the wrong field (no fixture match) → `"unknown"`.
- **Extract**: fixture gives canonical values (e.g. `gpa`, `major`, `skills`). Configured field names are normalized (lowercase, strip non-alphanumerics) and matched against canonical keys plus an alias table (`gpa ← grade_point_average, gradepoint`; `skills ← skill_list, skillset`; …). Unmatched names → `null`. Number type parses numbers; list type returns arrays.
- **Write**: level supplies a template with slots, e.g. `Hi {client}, invoice {invoice_id} for ${amount} is {days_overdue} days past due…`. A slot is filled only if the student's instructions reference that field (by token). Unreferenced slots fall back to vague phrases ("there", "your recent invoice", "the balance", "some time"). Teaches that the AI only knows what you pass it.

---

## 9. Levels

Each level adds exactly one idea on top of the previous ones. Full test data, reference solutions and trap solutions live in `src/levels/`.

| # | Level | New idea | Steps in the reference | Points |
|---|---|---|---|---|
| Demo | Your First Workflow | Triggers and actions (form → Slack #general) | 2 | 0 |
| 1 | Club RSVP | Using the person's answers (field chips into a sheet row) | 2 | 100 |
| 2 | Class Reminder | Schedules (weekly Monday 8 AM → Slack) | 2 | 100 |
| 3 | Freshman Mentors | Filters (year equals Freshman → personalized email) | 3 | 200 |
| 4 | Recruiting Inbox | Matching carefully ("ends with any of", lookalike domains) | 3 | 200 |
| 5 | Urgent Inbox | AI Classify + If/Else (urgent → Slack, else → sheet) | 5 | 300 |
| 6 | Resume Screener | AI Extract (GPA as a number, "3.45/4.0" edge case, ≥ 3.3) | 4 | 300 |
| 7 | Low-Stock Alerts | Loops (Read sheet → For each → field-vs-field filter → Slack) | 5 | 400 |
| 8 | Invoice Chaser | AI Write + Combine (reminders + one summary) | 8 | 400 |

Every level has: `task` (one sentence), `skill` + `skillHow` (the new idea in 1–2 sentences), `goals` ("done when" checklist), 2 hints, and tests (some hidden) with per-test `failHint`.

## 10. Design

Zapier's system, light mode only, with genaiiu.com's logo and colors. Tokens live in `src/app/globals.css`.

| Token | Value | Use |
|---|---|---|
| `paper` | `#fffefc` | Page, cards, inputs (warm white, never `#fff`) |
| `cream` | `#f7f5f2` | Side panels, canvas (genaiiu background) |
| `sand` | `#efebe7` | Hover, inset wells |
| `line` / `line-strong` | `#e5e0dc` / `#d2c9c4` | Hairline borders (genaiiu) |
| `ink` / `ink-2` / `muted` | `#2e1f1f` / `#4a3b3b` / `#7e6767` | Text (genaiiu warm browns) |
| `crimson` | `#981b25` | The one accent: primary buttons, current level, task card, data flowing during a run |
| `pass` / `fail` / `warn` | green / red / amber + soft tints | Test results and to-dos |
| Category tints | trigger orange, data amber, logic blue, AI violet, action green | Step icon tiles only |

- **Type:** Inter for everything functional; Bricolage Grotesque 600 with slightly open tracking (`.display`) for headings; small uppercase crimson eyebrows above titles.
- **Shapes:** pill buttons (`rounded-full`), 8px cards, 4px inputs, hairline rings instead of shadows.
- **Canvas:** cream dotted grid; steps are paper cards with a tinted icon, "N · Category" label, name, and a one-line summary or an amber to-do ("Pick a sheet."). Edges turn crimson and show item counts during a run.

### 10.1 Making it easy to follow
- **Left panel order:** Your task → New: skill (how it works) → Done when → Example data. No separate "situation" block.
- **Hints:** a Hint button in the top bar (popover with revealed hints, cost shown before revealing); revealed hints also appear in the left panel.
- **Results panel:** test tabs across the top (✓/✗), then two columns per test: "Should happen" (each line ✓ done / ✗ didn't happen) and "Your workflow did" (each line ✓ / ✗ shouldn't happen), the test's tip, and "show the data this test sent in". The grader returns these as structured `expected`/`actual` lines.
- **Top bar:** level stepper, countdown (turns crimson at 5 min, pulses in the last minute), points and live rank ("#3 of 41").
- **Board:** top 10 players plus "+N more"; everyone sees their own rank on their screen.
- **Controls:** every dropdown is a custom `Dropdown` (input-style button + paper menu in a portal, keyboard support; no native `<select>`, so no OS-styled popups); schedule uses outlined "Every hour / day / week" chips, round M–S day buttons, and a single time button ("8:00 AM") that opens a 30-minute list (hourly uses :00 / :15 / :30 / :45 chips); filter All/Any uses the same chips; host minutes is a − / + stepper.
- **Level intro card** the first time a level opens: situation → task (highlighted) → "You're done when" checklist → Start building. Level 1 adds a 3-step "how it works".
- **Mission panel** (left, always visible): the same three blocks plus example data shown as label/value records, test count, and hints.
- **Guide bar** (top of canvas): 3-step progress (trigger → set up steps → run) and one sentence saying the next action, e.g. "Finish setting up Add sheet row: Pick a sheet." Clicking it opens that step.
- **Add step** attaches the new step after the selected (or last) step automatically, so simple chains need no dragging.
- **Results drawer:** "N of M tests passed" with a pass/fail bar; each test shows "What went wrong" in plain sentences, "What your workflow did" (Slack/email/sheet previews) and "Data we sent in".

## 11. Repo structure

```
src/
  app/                       # page.tsx (join), play/, board/, host/ — thin wrappers around components
  engine/                    # pure TS, no React
    types.ts  template.ts  conditions.ts  schedule.ts  ai.ts
    nodes.ts                 # node catalog: defaults, validation, field propagation, summaries, run
    graph.ts  fields.ts  validate.ts  run.ts  grade.ts  build.ts
  levels/                    # 01-…08-*.ts, index.ts
  components/
    canvas/                  # Canvas (React Flow), NodeCard, FlowEdge, AddNodeMenu, icons
    panels/                  # BriefPanel, ConfigPanel, ResultsDrawer, DataPreview, fields
    play/                    # PlayScreen (phase gating), Workspace (run + animation), LevelIntro, GuideBar
    JoinScreen  BoardScreen  HostScreen  TopBar  ScreenGuard  ui (Button, Logo, Eyebrow)
  lib/                       # supabase, live (realtime hooks), store (zustand), teams, scoring, storage
supabase/migrations/0001_init.sql
tests/                       # engine.test.ts, levels.test.ts (reference + trap solutions)
```

### Level file shape

```ts
export const level: Level = {
  id: 4,
  slug: "recruiting-inbox",
  title: "Recruiting Inbox",
  tier: "medium",
  points: 200,
  brief: "...",
  goals: ["Only firm emails reach #recruiting", "Include the subject"],
  palette: ["trigger.email", "logic.filter", "logic.ifElse", "action.slack", "action.email"],
  resources: { channels: ["#recruiting", "#general"], sheets: {}, form: null },
  tests: [{ id: "t1", label: "Goldman Superday", hidden: false, input: {...}, expect: [...], failHints: {...} }],
  aiFixtures: {},
  hints: ["...", "..."],
  reference: workflowJson,
  traps: [{ name: "contains goldman", workflow: workflowJson, shouldFail: ["t5"] }],
};
```

---

## 12. Testing

- **Engine unit tests:** each operator, template rendering, For each / Combine edge cases (empty lists), cycle rejection, run cap, AI lookup misses.
- **Level tests (required before the meeting):** for every level, the reference solution passes all tests, and each trap solution fails exactly the tests it lists. This proves every level is solvable and every edge case actually bites.
- **Dry run:** 2–3 officers play all 8 levels on the deployed site a few days before, timed. Target: an average solo player reaches Level 4–5 in 30 minutes (consider 35–40 min). Fix confusing briefs and fail messages afterward.
- **Load:** ~50 concurrent players; Supabase free tier is enough.

---

## 13. Build order

1. Scaffold Next.js + Tailwind tokens + fonts. Deploy empty shell to Vercel.
2. Engine core: types, template, conditions, run, grade. Nodes: Form, Email trigger, Filter, Slack, Email, Sheet row. Unit tests.
3. Levels 1, 3, 4 data + reference/trap tests.
4. Canvas UI: React Flow nodes, add-node menu, config panel with field chips, validation badges.
5. Results drawer + world views + run animation. Play Levels 1–4 end to end locally.
6. Schedule, If/Else, Switch, AI nodes (simulated). Levels 2, 5, 6.
7. Read sheet, For each, Combine. Levels 7, 8.
8. Supabase: migration, team create/rejoin, completions, session phases, `/host`, `/board` realtime.
9. Polish, hint/skip flow, small-screen guard, dry run, fixes.

---

## 14. Fallbacks

- Site down / wifi fails: printed (or slide) version of the 8 scenarios; players sketch workflows on paper, organizer judges.
- Supabase down: `/play` keeps working from localStorage; leaderboard replaced by players calling out their level.
- A Zapier or n8n free account set up as a demo backup for the talk.

---

## 15. Out of scope

Live AI calls / API keys · multiple players per team · accounts or auth of any kind (including for /host) · boss/design round · calendar, files, webhooks, code nodes · mobile layout · anti-cheat · saving workflows across devices.

---

## 16. Open questions

- Meeting date, room, expected turnout (→ number of teams).
- New Supabase project or an existing one?
- Domain: Vercel subdomain or a genaiiu.com subdomain?
- Who runs `/host` during the meeting? (Anyone with the link can control it.)
- Does the talk include a live demo of Level 1 on the platform?
