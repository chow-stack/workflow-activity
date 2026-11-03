# Workflow Lab

**A hands-on classroom game for learning automation: build Zapier-style workflows on a visual canvas, run them against hidden tests, and race up a live leaderboard.**

Players drag triggers, logic, AI steps, and actions onto a canvas, wire them together, and press **Run**. A workflow passes when it produces the right emails, Slack messages, and sheet rows for every test case, however it is built. Eight levels each introduce one new idea, from a two-step form handler to an AI-powered invoice chaser with loops and summaries.

Built for the Gen AI Club at Indiana University. It needs no API keys: AI steps are simulated with deterministic fixtures, and every workflow runs in the browser.

![Next.js](https://img.shields.io/badge/Next.js-16-black) ![React Flow](https://img.shields.io/badge/React%20Flow-12-ff0072) ![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20Realtime-3ecf8e) ![License: MIT](https://img.shields.io/badge/license-MIT-blue)

---

## Contents

- [Features](#features)
- [Levels](#levels)
- [Running a session](#running-a-session)
- [Architecture](#architecture)
- [Getting started](#getting-started)
- [Testing](#testing)
- [Deployment](#deployment)
- [Security and trust model](#security-and-trust-model)
- [Project structure](#project-structure)
- [License](#license)

## Features

- **Visual workflow editor** built on [React Flow](https://reactflow.dev), with 15 node types across triggers, data, logic, simulated AI, and actions.
- **Output-based grading.** Hidden test cases check what the workflow *does*, not how its graph looks. Each failing test returns a targeted hint.
- **Simulated AI nodes.** *Classify*, *Extract*, and *Write* behave like real LLM steps but use per-level fixtures, so results are deterministic and free.
- **Live rooms.** The host gets a five-character join code, players join Kahoot-style, and the projector shows a realtime leaderboard.
- **Guided warm-up.** A demo level that the host presents before the clock starts.
- **Solutions walkthrough.** After the session, every level's reference solution is auto-laid out on a canvas, with step-by-step explanations and the common mistakes the tests caught.

## Levels

| # | Level | New idea | Points |
|---|---|---|:---:|
| Demo | Your First Workflow | Triggers and actions | — |
| 1 | Club RSVP | Mapping form answers into a sheet row | 100 |
| 2 | Class Reminder | Schedules | 100 |
| 3 | Freshman Mentors | Filters and personalized email | 200 |
| 4 | Recruiting Inbox | Careful matching (lookalike domains) | 200 |
| 5 | Urgent Inbox | AI Classify + If/Else routing | 300 |
| 6 | Resume Screener | AI Extract with numeric edge cases | 300 |
| 7 | Low-Stock Alerts | Loops: read sheet → for each → compare fields | 400 |
| 8 | Invoice Chaser | AI Write + Combine into one summary | 400 |

**Scoring:** each hint costs 25% of a level's points (up to 2 hints per level), and skipping scores 0. The leaderboard ranks by points, then levels cleared, then earliest finish. The maximum score is 2000.

## Running a session

The session takes about 10 minutes of introduction plus 35–40 minutes of play, on laptops at least 1280 px wide.

| Route | Who | Purpose |
|---|---|---|
| `/` | Players | Join with the room code, then a name. `/?room=CODE` prefills the code. |
| `/play` | Players | The warm-up demo, then the 8 levels. |
| `/host` | Host | Create a room and run it: Lobby → Demo → Levels → Done. Only the browser that created the room can control it. |
| `/board?room=CODE` | Projector | Join code, demo progress, live leaderboard, final podium. |
| `/demo` | Host | The warm-up level for presenting. Nothing is recorded. |
| `/solutions?room=CODE` | Host | Every level's solution, explained step by step. Unlocks when the room ends. |

The full product and design spec is in [SPEC.md](SPEC.md).

## Architecture

```
Browser (Next.js + React Flow + Zustand)              Supabase
┌─────────────────────────────────────────┐          ┌─────────────────────────────┐
│ Canvas ─▶ src/engine (pure TypeScript)  │  insert  │ rooms, teams, completions   │
│   validate → run → grade vs. level tests│ ───────▶ │ RLS: public read, guarded   │
│   simulated AI from level fixtures      │ ◀─────── │ inserts; host actions via   │
└─────────────────────────────────────────┘ Realtime │ SECURITY DEFINER functions  │
                                                     └─────────────────────────────┘
```

- **`src/engine/`** is a framework-free TypeScript module that validates the graph, executes items through nodes, simulates AI steps, and grades the resulting "world" (emails, Slack messages, sheet rows) against each test case.
- **`src/levels/`** defines each level: the task, available nodes, sheets and channels, AI fixtures, visible and hidden tests, hints, a reference solution, and "trap" solutions that must fail.
- **Supabase** stores only rooms, players, and completed levels, and streams leaderboard changes over Realtime. Host controls are a database function checked against a secret host key, so the app needs only the public publishable key.

## Getting started

### Prerequisites

- Node.js 20 or newer
- A Supabase project (the free tier is enough)

### 1. Install

```bash
git clone https://github.com/chow-stack/workflow-activity.git
cd workflow-activity
npm install
```

### 2. Set up the database

Apply the SQL files in `supabase/migrations/` in order, using the Supabase SQL editor or the CLI:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

### 3. Configure the environment

```bash
cp .env.example .env.local
```

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your project URL, `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The project's **publishable** key (`sb_publishable_...`) |

### 4. Run

```bash
npm run dev
```

Open <http://localhost:3000/host> to create a room, and <http://localhost:3000> in another window to join it.

## Testing

```bash
npm test        # Vitest
npm run lint
```

The suite covers the engine and every level. Each level's reference solution must pass all of its tests, and each trap solution must fail exactly the tests it targets. Run it after editing anything in `src/levels/` or `src/engine/`.

### Adding a level

1. Create `src/levels/NN-your-level.ts`, using an existing level as a template.
2. Register it in `src/levels/index.ts`.
3. Provide a reference solution and at least one trap solution per common mistake.
4. Run `npm test`.

## Deployment

1. Import the repository into [Vercel](https://vercel.com/new) (or any Next.js host).
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Before a session, open the site to make sure the Supabase project has not been paused for inactivity.

## Security and trust model

- **No secrets in the client.** The app uses only the publishable Supabase key, which is public by design. Access is enforced by Row Level Security.
- **Host controls require a secret host key.** It is generated per room, stored in `room_keys` (no client access), and kept only in the host's browser.
- **Scores are self-reported.** Workflows are graded in the browser, and the browser records completions. RLS only accepts a completion while the room is running and for a team in that room. There are no player accounts, and anti-cheat is [explicitly out of scope](SPEC.md). Someone with dev tools could post a fake score or claim a level for another player. That's acceptable for a friendly in-room activity, but don't reuse this design where scores matter.

To report a security issue, please open a private [security advisory](https://github.com/chow-stack/workflow-activity/security/advisories/new) rather than a public issue.

## Project structure

```
src/
├── app/                 Routes: /, /play, /host, /board, /demo, /solutions
├── components/
│   ├── canvas/          React Flow canvas, nodes, edges, add-node menu
│   ├── panels/          Brief, node configuration, data preview, results drawer
│   └── play/            Player workspace, guide bar, hints, level intros
├── engine/              Pure TS: graph, validate, run, conditions, templates, simulated AI, grading
├── levels/              Demo + 8 levels with tests, hints, reference and trap solutions
└── lib/                 Supabase client, realtime, scoring, Zustand store, local storage
supabase/migrations/     Database schema (apply in order)
tests/                   Engine and level tests
SPEC.md                  Full product and design specification
```

## License

Released under the [MIT License](LICENSE).
