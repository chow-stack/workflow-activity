# Workflow Lab

Gen AI Club automation meeting activity. Players build Zapier-style workflows, run them against hidden tests, and climb a live leaderboard. Full design in [SPEC.md](SPEC.md).

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in the Supabase URL + publishable key
npm run dev
```

- `/` players join with the room code, then their name (`/?room=CODE` prefills it)
- `/play` the warm-up demo, then the 8 levels (laptop only)
- `/board?room=CODE` the big screen: join code, demo progress, leaderboard
- `/demo` the warm-up level for the host to present (nothing is recorded)
- `/solutions?room=CODE` after the session ends: every level's solution, explained step by step
- `/host` create a room and run it: Lobby → Demo → Levels → Done. Only the laptop that created the room can control it

## Tests

```bash
npm test
```

Every level's reference solution must pass all its tests, and every trap solution must fail the tests it targets. Run this after editing any level in `src/levels/`.

## Supabase

Schema: `supabase/migrations/` (apply in order). Host controls are a database function, so the app only needs the public publishable key.

## Deploy

Import the repo in Vercel and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
