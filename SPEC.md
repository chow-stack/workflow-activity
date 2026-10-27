# Workflow Activity — Build Spec

Gen AI Club automation meeting. Teams build automation workflows on an n8n-style canvas, run them against hidden test cases, and climb a live leaderboard. Eight graded levels, then a design-only boss round.

Status: draft v1 · 2026-10-27

---

## 1. Decisions (locked)

| Topic | Decision |
|---|---|
| Format | ~10 min talk → ~30 min graded levels → ~10 min boss round → wrap-up |
| Teams | Groups of 3–4. **One team captain per team** runs the platform on one laptop; the rest of the team talks it through. No join codes, no member accounts. |
| AI | **Fully simulated.** No live model calls, no API keys. AI blocks return fixed answers per test input. |
| Grading | By **output**, not by graph shape. Any workflow that produces the right Slack messages / emails / sheet rows passes. |
| Execution | Entirely client-side (browser). |
| Backend | None beyond Supabase for teams, completions, session state, boss submissions, and the realtime leaderboard. |
| Hosting | Vercel |
| Devices | Laptop only (≥1280px wide). Below 1024px show a "use a laptop" screen. |
| Design | genaiiu.com look for app chrome (cream, Playfair, crimson). n8n-style dark canvas re-tinted to club maroon. |

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
| Fonts | `next/font/google`: Playfair Display, DM Sans, JetBrains Mono |
| Icons | lucide-react |

---

## 3. Routes

| Route | Who | Purpose |
|---|---|---|
| `/` | Captain | Create team (team name only) or rejoin an existing team by name |
| `/play` | Captain | Level brief + canvas + config panel + results |
| `/board` | Projector | Live leaderboard, countdown, boss gallery |
| `/host` | Organizer | Passcode-gated controls: start / pause / start boss / end / reset |

### 3.1 Session phases
Stored in Supabase `session` row; every client subscribes via Realtime.

| Phase | `/play` shows | `/board` shows |
|---|---|---|
| `lobby` | "Waiting for the host to start" + team name | Joined teams list |
| `running` | Levels 1–8, countdown to `ends_at` | Leaderboard + countdown |
| `boss` | Boss canvas (design only) | Leaderboard frozen + "Boss round" countdown |
| `ended` | Final score, read-only | Final standings, then boss gallery |

Host can pause (`running` → `paused`, stores remaining seconds) and resume.

---

## 4. Team flow

1. Captain opens `/`, types a team name, clicks **Create team**. Insert into `teams`; names are unique (case-insensitive). Taken name → inline error.
2. `team_id` + name stored in `localStorage`. Revisiting `/` with a stored team skips straight to `/play`.
3. **Rejoin** (laptop died / different browser): enter exact team name → fetch team id → completed levels restored from `completions`. Unsaved canvas work for the current level is lost. No auth; acceptable for a club meeting.
4. Levels unlock in order. Solved levels can be reopened (read-only score, editable canvas).
5. **Skip**: available after both hints are used on a level. Skipped = 0 points, next level unlocks.

### localStorage (per team)
`team`, `currentLevel`, `workflows[levelId]` (nodes + edges JSON, autosaved debounced 500ms), `hintsUsed[levelId]`.

---

## 5. Data model (Supabase)

```sql
create table session (
  id int primary key default 1 check (id = 1),
  phase text not null default 'lobby',      -- lobby | running | paused | boss | ended
  ends_at timestamptz,                      -- running/boss countdown target
  paused_remaining_s int
);

create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);
create unique index teams_name_ci on teams (lower(name));

create table completions (
  team_id uuid references teams on delete cascade,
  level int not null check (level between 1 and 8),
  points int not null,
  hints_used int not null default 0,
  skipped boolean not null default false,
  completed_at timestamptz default now(),
  primary key (team_id, level)
);

create table boss_submissions (
  team_id uuid primary key references teams on delete cascade,
  title text not null,
  problem text not null,
  workflow jsonb not null,
  submitted_at timestamptz default now()
);
```

**RLS**
- `anon`: `select` on all four tables; `insert` on `teams`, `completions`, `boss_submissions`. No `update`/`delete`.
- `session` writes and reset only through `/api/host/*` route handlers using the service-role key, gated by `HOST_PASSCODE`.
- Realtime enabled on `session`, `teams`, `completions`, `boss_submissions`.

**Env vars:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only), `HOST_PASSCODE` (server only).

Grading is client-side, so scores are trust-based. Accepted.

---

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
- Boss round is not scored in-app; winner by room vote.

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

Format per level: brief, palette, data, test cases (✱ = hidden until first run), expected outputs, traps the tests catch, hints, reference solution. Every level file also exports its **reference solution** and **trap solutions** for unit tests (§12).

Assertion types:
- `slack { channel, includes?: string[], includesNumber?: number[] }`
- `email { to, subjectIncludes?, bodyIncludes?: string[], includesNumber?: number[] }`
- `sheetRow { sheet, match: Record<column, value> }`

All matching is case-insensitive. `includesNumber` accepts `4250`, `4,250`, `4250.00`, `$4,250`. A test passes when every expected output is matched one-to-one **and** nothing extra was produced.

---

### Level 1 · Club RSVP · Easy · 100
**Brief:** People RSVP to Gen AI Club meetings on a form. Every RSVP should land in the RSVPs sheet automatically.
**Teaches:** trigger → action.
**Palette:** Form submitted, New email, Add sheet row, Slack message.
**Form fields:** `name`, `email`, `year`, `dietary`.
**Sheet:** `RSVPs` (Name, Email, Year).

| Test | Input | Expected |
|---|---|---|
| 1 | Maya Patel, mpatel@iu.edu, Sophomore | Row (Maya Patel, mpatel@iu.edu, Sophomore) |
| 2 | Jordan Lee, jlee@iu.edu, Junior | Row (Jordan Lee, …) |
| 3 ✱ | Sam Ortiz, sortiz@iu.edu, Freshman | Row (Sam Ortiz, …) |

**Traps:** typed a literal name instead of `{{name}}`; mapped email into Name.
**Hints:** (1) "Which event starts this: an email, or a form?" (2) "In Add sheet row, click the field chips to fill each column."
**Reference:** Form submitted → Add sheet row (Name=`{{name}}`, Email=`{{email}}`, Year=`{{year}}`).

---

### Level 2 · Class Reminder · Easy · 100
**Brief:** Your C204 study group wants a Slack reminder every Monday at 8:00 AM: "C204 quiz today."
**Teaches:** schedule trigger, time as an input.
**Palette:** Schedule, Form submitted, Slack message, Send email.
**Channels:** `#c204-study`, `#general`.
**Simulated window:** Sun 00:00 → Sat 23:59 of one week.

| Test | Expected |
|---|---|
| 1 | Exactly 1 Slack message in `#c204-study`, includes "quiz", fired Monday 08:00 |

**Traps:** every day → 7 messages; every hour → 168; wrong weekday or time; wrong channel.
**Fail messages:** "Sent 7 messages this week; expected 1." / "Sent on Tuesday at 08:00; expected Monday."
**Hints:** (1) "How often should this run: every day, or every week?" (2) "Schedule → every week → Monday → 08:00."
**Reference:** Schedule (weekly, Mon, 08:00) → Slack `#c204-study` "C204 quiz today".

Grading note: the test also asserts the fire time, so the engine records `fired_at` on each world output.

---

### Level 3 · Personalized Welcome · Medium · 200
**Brief:** New members fill out a sign-up form. Send each one a welcome email that greets them by first name and mentions their major.
**Teaches:** mapping trigger data into text.
**Palette:** Form submitted, Send email, Slack message, Add sheet row.
**Form fields:** `first_name`, `last_name`, `email`, `major`.

| Test | Input | Expected email |
|---|---|---|
| 1 | Ava Chen, achen@iu.edu, Finance | to achen@iu.edu, body includes "Ava", "Finance" |
| 2 | Leo Brooks, lbrooks@iu.edu, Informatics | includes "Leo", "Informatics" |
| 3 ✱ | Priya Shah, pshah@iu.edu, Finance + Business Analytics | includes "Priya", "Finance + Business Analytics" |

**Traps:** hardcoded "Hi Ava" (fails tests 2–3); `{{last_name}}` instead of first; To left as a literal address.
**Hints:** (1) "The email changes per person. Where does each person's info come from?" (2) "Use `{{first_name}}` and `{{major}}` in the body, and `{{email}}` in To."
**Reference:** Form → Send email (To `{{email}}`, Subject "Welcome to Gen AI Club!", Body "Hi {{first_name}}, welcome! Great to have a {{major}} major on board.").

---

### Level 4 · Recruiting Inbox · Medium · 200
**Brief:** Your inbox is flooded. Only emails from these firms should be posted to Slack `#recruiting`, with the subject: **goldmansachs.com, jpmorgan.com, mckinsey.com**.
**Teaches:** filters and edge cases.
**Palette:** New email, Filter, If / Else, Slack message, Send email.
**Channels:** `#recruiting`, `#general`.

| Test | From | Subject | Expected |
|---|---|---|---|
| 1 | recruiting@goldmansachs.com | Superday invitation | Slack `#recruiting` includes "Superday invitation" |
| 2 | campus@jpmorgan.com | Coffee chat next week | Slack includes "Coffee chat next week" |
| 3 | news@iu.edu | Kelley weekly digest | nothing |
| 4 ✱ | talent@mckinsey.com | Case interview prep session | Slack includes "Case interview prep session" |
| 5 ✱ | careers@goldman-sachs-jobs.net | URGENT: claim your offer | nothing |
| 6 ✱ | promo@jpmorgan.com.deals.biz | You've been selected | nothing |

**Traps:** `contains "goldman"` (lets test 5 through); `contains "jpmorgan.com"` (lets test 6 through); no filter (6 messages).
**Fail message (5):** "A lookalike domain reached #recruiting. Check exactly how the sender address ends."
**Hints:** (1) "Check the end of the sender address, not just whether it mentions the firm." (2) "Filter: `from` · ends with any of · `goldmansachs.com, jpmorgan.com, mckinsey.com`."
**Reference:** New email → Filter (`from` ends with any of list) → Slack `#recruiting` "{{from_name}}: {{subject}}".

---

### Level 5 · Review Router · Hard · 300
**Brief:** Hoosier Bean, a campus coffee shop, gets reviews through a form. Positive reviews go to the Testimonials sheet. Negative reviews alert `#customer-care` in Slack. Questions get an email reply to the reviewer.
**Teaches:** AI classification + multi-way routing.
**Palette:** Form submitted, AI Classify, Switch, If / Else, Add sheet row, Slack message, Send email.
**Form fields:** `reviewer`, `email`, `review_text`.
**Sheet:** `Testimonials` (Reviewer, Review). **Channels:** `#customer-care`, `#general`.

| Test | Review (fixture label) | Expected |
|---|---|---|
| 1 | "Best cold brew on campus, the staff remember my order." (positive) | Row in Testimonials (Reviewer, Review) |
| 2 | "My latte was cold and the line took 25 minutes." (negative) | Slack `#customer-care` includes reviewer name |
| 3 | "Do you have oat milk, and are you open on Sundays?" (question) | Email to reviewer |
| 4 ✱ | "Great, waited 40 minutes for a muffin. Love that for me." (negative) | Slack `#customer-care` |
| 5 ✱ | "Super cozy spot for studying, love the playlist." (positive) | Row in Testimonials |
| 6 ✱ | "Is the student discount still 10%?" (question) | Email to reviewer |

**Traps:** labels missing `question` → tests 3/6 return `unknown`; classifying `reviewer` instead of `review_text` → all `unknown`; If/Else with 2 branches only.
**Fail message (4):** "This sarcastic review was routed as positive. What did the AI label it?" (only shown if routed wrong).
**Hints:** (1) "The AI can only pick from labels you give it. Are all three there?" (2) "AI Classify (`review_text`, labels `positive, negative, question`) → Switch on `label`."
**Reference:** Form → AI Classify → Switch(`label`: positive / negative / question) → Add sheet row / Slack / Send email.

---

### Level 6 · Resume Screener · Hard · 300
**Brief:** You're screening analyst applications. Log **every** applicant in the Applicants sheet. Applicants with a **GPA of 3.3 or higher** who list **Excel** get an interview invite email.
**Teaches:** AI extraction → fields that later steps depend on; fan-out.
**Palette:** Form submitted, AI Extract, AI Classify, Filter, If / Else, Add sheet row, Send email.
**Form fields:** `name`, `email`, `resume_text`.
**Sheet:** `Applicants` (Name, Email, GPA, Major).

| Test | Resume highlights (fixture) | Expected |
|---|---|---|
| 1 | GPA 3.7, Finance, Excel, PowerPoint | Row + invite |
| 2 | GPA 3.2, Accounting, Excel | Row only |
| 3 | GPA 3.8, Informatics, Python, SQL | Row only |
| 4 ✱ | "GPA: 3.45/4.0", Business Analytics, Advanced Excel modeling | Row (GPA 3.45) + invite |
| 5 ✱ | GPA 3.3, Finance, Excel, Bloomberg | Row + invite (boundary) |

Invite assertion: `email { to: applicant, bodyIncludes: [first name] }`.

**Traps:** filter before the sheet row (rejected applicants not logged); `>` instead of `≥` (fails test 5); filtering on `resume_text contains "Excel"` without GPA; GPA mapped as text "3.45/4.0" (test 4 sheet row expects 3.45).
**Hints:** (1) "Pull the GPA, major and skills out of the resume first, then decide." (2) "AI Extract (`gpa` number, `major` text, `skills` list) → connect to BOTH Add sheet row and a Filter (`gpa ≥ 3.3` AND `skills contains Excel`) → Send email."
**Reference:** Form → AI Extract → [Add sheet row] + [Filter → Send email].

---

### Level 7 · Coffee Shop Restock · Expert · 400
**Brief:** Every night at 9 PM, Hoosier Bean checks inventory. Anything **below** its reorder level goes into **one** order email to the supplier (orders@midwestroasters.example). If nothing is low, send nothing.
**Teaches:** reading data, loops, "collect then act once."
**Palette:** Schedule, Read sheet, For each, Filter, Combine, Send email, Slack message, If / Else.
**Sheet:** `Inventory` (item, stock, reorder_level, unit).
**Simulated window:** one Tuesday, 00:00 → 23:59.

| Test | Inventory | Expected |
|---|---|---|
| 1 | 8 items; low: Oat milk (2/6 cartons), Espresso beans (3/10 lbs), Cups 12oz (40/100); Whole milk 6/6 (equal, not low) | Exactly 1 email to supplier, body includes "Oat milk", "Espresso beans", "Cups 12oz"; body does **not** include "Whole milk" |
| 2 ✱ | Same 8 items, all fully stocked | No email |

Assertion addition: `bodyExcludes?: string[]`.

**Traps:** no Combine → 3 emails ("Sent 3 emails; the supplier wants one order."); `≤` instead of `<` (Whole milk included); daily at wrong time is fine for grading, but weekly → 0 runs on Tuesday; filter compares `stock` to a literal instead of the `reorder_level` field.
**Hints:** (1) "Read the sheet, go through each row, keep the low ones, then bundle them before emailing." (2) "Schedule (daily 21:00) → Read sheet → For each `rows` → Filter `stock < {{reorder_level}}` → Combine (line template `{{item}}: {{stock}} {{unit}}`) → Send email body `{{lines}}`."
**Reference:** as hint 2.

---

### Level 8 · Invoice Chaser · Expert · 400
**Brief:** A freelance bookkeeping business chases late invoices every morning at 9 AM. For each **unpaid** invoice **more than 30 days** overdue, email the client a polite reminder that mentions the client name, invoice number and amount. Then post **one** Slack summary in `#owner`: how many overdue invoices and the total outstanding.
**Teaches:** loop + AI writing with context + summary after the loop.
**Palette:** Schedule, Read sheet, For each, Filter, If / Else, AI Write, Combine, Send email, Slack message.
**Sheet:** `Invoices` (invoice_id, client, client_email, amount, days_overdue, status).
**AI Write template:** `Hi {client}, this is a friendly reminder that invoice {invoice_id} for ${amount} is now {days_overdue} days past due. Please let us know if you have any questions.`

| Test | Invoices | Expected |
|---|---|---|
| 1 | 8 rows: qualifying INV-104 Lakeside Dental $1,200 / 45d, INV-107 Bloom Florals $850 / 62d, INV-111 Kirkwood Cycles $2,200 / 33d; excluded: INV-102 Paid 50d, INV-109 Unpaid exactly 30d, INV-112 Unpaid 12d, two Paid recent | 3 emails, each to the right `client_email`, body includes client name, invoice id, `includesNumber` amount. 1 Slack `#owner`, `includesNumber` [3, 4250] |
| 2 ✱ | All paid | No emails, no Slack |

**Traps:** filter `≥ 30` (INV-109 included); status filter missing (INV-102 included); AI Write instructions without `{{amount}}` → email says "the balance" ("The reminder doesn't mention the amount. Did the AI know it?"); Slack inside the loop → 3 messages; Combine without `sum of amount`.
**Hints:** (1) "Two jobs after the filter: one per invoice (emails), one for all of them (summary). Connect the filter to both." (2) "Filter (`status equals Unpaid` AND `days_overdue > 30`) → [AI Write with `{{client}}`, `{{invoice_id}}`, `{{amount}}`, `{{days_overdue}}` → Send email To `{{client_email}}` Body `{{ai_text}}`] + [Combine (count, sum amount) → Slack `#owner` `{{count}} overdue invoices, ${{sum_amount}} outstanding`]."
**Reference:** as hint 2.

---

### Boss · Design Your Own · not scored
**Brief:** Pick a real annoying task from your life, job, club, or a business you know. Design the workflow that would automate it.
- Full palette, no tests, Run disabled.
- Form: **Title** (≤60 chars), **Problem it solves** (≤140 chars), **Submit design**.
- Submits `{ title, problem, workflow JSON }` through a `security definer` Postgres function `submit_boss(team_id, title, problem, workflow)` granted to anon, which upserts (`on conflict do update`). Resubmitting overwrites; anon still has no direct update rights.
- `/board` in `ended` phase shows a gallery: read-only React Flow render of each submission + title + problem. Host clicks through full-screen; room votes by hand.

---

## 10. Design

### 10.1 Split
- **App chrome** (join page, top bar, brief panel, config panel, results, `/board`, `/host`): genaiiu.com — light, editorial.
- **Canvas**: n8n structure, club colors — dark maroon-black, dotted grid, glowing data flow.

### 10.2 Tokens

```css
:root {
  /* Chrome — genaiiu.com (measured 2026-10-27) */
  --cream: #F7F5F2;          /* page background */
  --ink: #2E1F1F;            /* text */
  --ink-muted: #7E6767;      /* secondary text */
  --line: #E5E0DC;           /* borders, dividers */
  --crimson: #981B25;        /* primary buttons, active states */
  --crimson-tint: rgba(152, 27, 37, 0.1);
  --surface: #FFFFFF;        /* cards on cream */

  /* Canvas — n8n structure, club palette */
  --canvas-bg: #1A1213;
  --canvas-dot: #3A2A2B;
  --node-bg: #261B1C;
  --node-border: #3D2C2D;
  --node-text: #EDE6E3;
  --node-muted: #A8999A;
  --edge-idle: #5A4446;
  --edge-flow: linear-gradient(90deg, #981B25, #F07A3D);  /* animated during runs */

  /* Node categories (left accent bar + icon tile) */
  --cat-trigger: #D9434F;
  --cat-data: #E0A44B;
  --cat-logic: #7C93C3;
  --cat-ai: #C77DBA;
  --cat-action: #6FAF8A;

  /* Status */
  --pass: #3E9B6A;
  --fail: #D64545;
  --warn: #C98A1B;

  /* Type */
  --font-display: "Playfair Display", serif;   /* 500 */
  --font-ui: "DM Sans", sans-serif;            /* 400, 500 */
  --font-mono: "JetBrains Mono", monospace;    /* data payloads */

  /* Radii */
  --r-input: 8px; --r-button: 8px; --r-node: 12px; --r-card: 16px; --r-pill: 9999px;
}
```

### 10.3 `/play` layout (≥1280px)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Logo · Team name      ① ② ③ ④ ⑤ ⑥ ⑦ ⑧          ⏱ 24:13   1,150 pts │  top bar, cream
├──────────────┬───────────────────────────────────────┬───────────────┤
│ LEVEL BRIEF  │                                       │ NODE CONFIG   │
│ Playfair h2  │        dark dotted canvas             │ (slides in    │
│ scenario     │   [Trigger]──▶[Filter]──▶[Slack]      │  when a node  │
│ goal list    │                                       │  is selected) │
│ sample input │                          ＋ Add node  │ fields, chips │
│ Hints (2)    │                         ▶ Run tests   │               │
├──────────────┴───────────────────────────────────────┴───────────────┤
│ RESULTS (slides up after run): test cards · World tabs: Slack | Email │
│ | Sheets — shows what the workflow actually produced                  │
└──────────────────────────────────────────────────────────────────────┘
```

- Brief panel 320px, config panel 360px, results drawer ~40% height.
- **Add node**: n8n-style searchable menu grouped by category, opens from the `＋` button or by dragging off an output handle.
- **Node**: 12px radius, `--node-bg`, 4px left bar in category color, 32px icon tile, title + one-line config summary ("ends with any of 3 domains"). Selected: crimson ring. Error: red badge top-right.
- **Edges**: smooth-step bezier, `--edge-idle`; labeled handles on If/Else and Switch outputs.

### 10.4 Run animation
For the **first test case only** (keeps it fast): nodes execute in order, edges carry an animated crimson→ember dash along the path items took, item count badge on each edge ("3 items"), each node ends with a green check or red ✕. AI nodes show a 400ms "thinking" shimmer. Remaining tests grade instantly. Then results drawer opens.

### 10.5 Results drawer
- One card per test: ✓/✕, label, and on fail a plain-English reason ("Expected 1 Slack message in #recruiting, got 0").
- Hidden tests show title only until the first run, then their input.
- **World tabs** render outputs as mini UIs: Slack (channel + message bubbles), Email (inbox list), Sheets (table). Monospace for raw values.
- All pass → full-width success banner, points earned, **Next level**.

### 10.6 `/board` (projector)
Light theme, very large type. Columns: rank · team · 8 progress pips (filled crimson = cleared, outlined = not, gray = skipped) · points. Countdown top right. Small ticker: "Team X just cleared Level 6." Top 3 rows get a subtle crimson tint.

---

## 11. Repo structure

```
src/
  app/
    page.tsx                 # create / rejoin team
    play/page.tsx
    board/page.tsx
    host/page.tsx
    api/host/[action]/route.ts   # start, pause, resume, boss, end, reset (service role + passcode)
  engine/
    types.ts                 # Item, Workflow, NodeDef, World, TestCase, Assertion
    nodes/                   # one file per node type: config schema, outputFields, run
    run.ts                   # executeWorkflow(workflow, level, testCase) → { world, trace }
    grade.ts                 # gradeLevel(workflow, level) → TestResult[]
    template.ts              # {{token}} rendering
    conditions.ts            # operators + comparison rules
    ai.ts                    # simulated classify / extract / write
  levels/
    01-club-rsvp.ts … 08-invoice-chaser.ts, boss.ts, index.ts
  components/
    canvas/                  # React Flow nodes, edges, add-node menu
    panels/                  # brief, config, results, world views
    board/
  lib/
    supabase.ts, session.ts, storage.ts, scoring.ts
  styles/tokens.css
supabase/
  migrations/0001_init.sql
tests/
  engine/*.test.ts
  levels/*.test.ts
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
- **Dry run:** 2–3 officers play all 8 levels on the deployed site a few days before, timed. Target: an average team reaches Level 5–6 in 30 minutes. Fix confusing briefs and fail messages afterward.
- **Load:** ~15 concurrent teams; Supabase free tier is enough.

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
9. Boss mode + gallery.
10. Polish, hint/skip flow, small-screen guard, dry run, fixes.

---

## 14. Fallbacks

- Site down / wifi fails: printed (or slide) version of the 8 scenarios; teams sketch workflows on paper, organizer judges.
- Supabase down: `/play` keeps working from localStorage; leaderboard replaced by teams calling out their level.
- n8n cloud trial set up as a demo backup for the talk.

---

## 15. Out of scope

Live AI calls / API keys · multiple players per team · accounts or auth beyond the host passcode · calendar, files, webhooks, code nodes · mobile layout · anti-cheat · saving workflows across devices.

---

## 16. Open questions

- Meeting date, room, expected turnout (→ number of teams).
- New Supabase project or an existing one?
- Domain: Vercel subdomain or a genaiiu.com subdomain?
- Who holds `HOST_PASSCODE` and runs `/host` during the meeting?
- Does the talk include a live demo of Level 1 on the platform?
