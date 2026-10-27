# Workflow Lab

Gen AI Club automation meeting activity. Teams build n8n-style workflows, run them against hidden tests, and climb a live leaderboard. Full design in [SPEC.md](SPEC.md).

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in the Supabase URL + publishable key
npm run dev
```

- `/` captain creates or rejoins a team
- `/play` the canvas (laptop only)
- `/board` projector leaderboard
- `/host` passcode-gated controls (start, pause, boss round, end, reset)

## Tests

```bash
npm test
```

Every level's reference solution must pass all its tests, and every trap solution must fail the tests it targets. Run this after editing any level in `src/levels/`.

## Supabase

Schema: `supabase/migrations/0001_init.sql`. Host controls are database functions gated by a bcrypt-hashed passcode in `private.host_secret`, so the app only needs the public publishable key.

## Deploy

Import the repo in Vercel and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
