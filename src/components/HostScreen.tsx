"use client";

import { Check, Copy, ExternalLink, LoaderCircle, MonitorPlay, Users } from "lucide-react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { LEVELS } from "@/levels";
import { formatClock, secondsLeft, useLeaderboardData, useNow, useRoom } from "@/lib/live";
import { standings } from "@/lib/scoring";
import { KEYS, load, remove, save } from "@/lib/storage";
import { supabase, type Phase } from "@/lib/supabase";
import { createRoom } from "@/lib/teams";
import { Stepper } from "./panels/fields";
import { Button, Eyebrow, Logo } from "./ui";

type Action = "demo" | "start" | "pause" | "resume" | "add_time" | "end" | "lobby" | "reset";
interface HostRoom {
  code: string;
  hostKey: string;
}

const STAGES: { phase: Phase[]; label: string }[] = [
  { phase: ["lobby"], label: "Lobby" },
  { phase: ["demo"], label: "Demo" },
  { phase: ["running", "paused"], label: "Levels" },
  { phase: ["ended"], label: "Done" },
];

export function HostScreen() {
  const [host, setHost] = useState<HostRoom | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Read after mount: localStorage isn't available during server prerender.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHost(load<HostRoom | null>(KEYS.host, null));
    setReady(true);
  }, []);

  const create = async () => {
    setBusy(true);
    setError(null);
    const res = await createRoom();
    setBusy(false);
    if (!res.code || !res.hostKey) return setError(res.error ?? "Couldn't create a room.");
    const h = { code: res.code, hostKey: res.hostKey };
    save(KEYS.host, h);
    setHost(h);
  };

  const leave = () => {
    if (!window.confirm("Close this room on this laptop and start fresh? Players in it keep their scores.")) return;
    remove(KEYS.host);
    setHost(null);
  };

  if (!ready) return null;

  if (!host) {
    return (
      <Shell>
        <div className="mx-auto max-w-md py-24 text-center">
          <Eyebrow className="justify-center">Host</Eyebrow>
          <h1 className="display mt-3 text-[40px] leading-tight">Run a Workflow Lab session</h1>
          <p className="mt-3 text-[15.5px] leading-relaxed text-ink-2">
            Create a room to get a join code. Put the big screen up, walk everyone through the demo, then start the clock.
          </p>
          <Button size="lg" onClick={create} disabled={busy} className="mt-8">
            {busy && <LoaderCircle size={17} className="animate-spin" />}
            Create a room
          </Button>
          {error && <p className="mt-3 text-[14px] text-fail">{error}</p>}
        </div>
      </Shell>
    );
  }

  const lost = () => {
    remove(KEYS.host);
    setHost(null);
  };
  return <HostRoomView host={host} onLeave={leave} onLost={lost} />;
}

function HostRoomView({ host, onLeave, onLost }: { host: HostRoom; onLeave: () => void; onLost: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Action | null>(null);
  const [minutes, setMinutes] = useState(30);
  const [copied, setCopied] = useState(false);
  const { room, missing } = useRoom(host.code);
  const { teams, completions } = useLeaderboardData(host.code);
  const now = useNow();
  const rows = useMemo(() => standings(teams, completions), [teams, completions]);
  const demoDone = useMemo(() => new Set(completions.filter((c) => c.level === 0).map((c) => c.team_id)), [completions]);
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
  const joinUrl = `${origin}/?room=${host.code}`;

  useEffect(() => {
    if (missing) onLost();
  }, [missing, onLost]);

  const act = async (action: Action, mins?: number) => {
    if (action === "reset" && !window.confirm("Remove every player and score from this room and go back to the lobby?")) return;
    if (action === "end" && !window.confirm("End the session for everyone?")) return;
    setBusy(action);
    const { error: err } = await supabase().rpc("host_room", { p_code: host.code, p_key: host.hostKey, p_action: action, p_minutes: mins ?? null });
    setBusy(null);
    setError(err ? err.message : null);
  };

  const btn = (action: Action, label: string, opts: { variant?: "primary" | "secondary" | "danger"; mins?: number } = {}) => (
    <Button variant={opts.variant ?? "secondary"} onClick={() => act(action, opts.mins)} disabled={busy !== null}>
      {busy === action && <LoaderCircle size={15} className="animate-spin" />}
      {label}
    </Button>
  );

  const phase = room?.phase ?? "lobby";
  const stage = STAGES.findIndex((s) => s.phase.includes(phase));
  const clock = phase === "running" || phase === "paused" ? formatClock(secondsLeft(room, now)) : null;

  return (
    <Shell
      right={
        <a
          href={`/board?room=${host.code}`}
          target="_blank"
          className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[14px] font-medium ring-1 ring-ink hover:bg-cream"
        >
          Open the big screen <ExternalLink size={14} />
        </a>
      }
    >
      <main className="mx-auto max-w-3xl px-8 py-10">
        <section className="flex items-center justify-between gap-6 rounded-lg bg-cream p-6 ring-1 ring-line">
          <div>
            <div className="text-[13px] font-medium text-muted">Room code</div>
            <div className="mt-1 font-mono text-[48px] leading-none font-semibold tracking-[0.18em]">{host.code}</div>
          </div>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(joinUrl);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }}
            className="flex items-center gap-2 rounded-full bg-paper px-4 py-2 text-[13.5px] text-ink-2 ring-1 ring-line hover:ring-ink-2"
          >
            {copied ? <Check size={14} className="text-pass" /> : <Copy size={14} />}
            {copied ? "Copied" : joinUrl.replace(/^https?:\/\//, "")}
          </button>
        </section>

        <ol className="mt-8 flex items-center gap-2">
          {STAGES.map((s, i) => (
            <li key={s.label} className="flex flex-1 items-center gap-2">
              <span
                className={`grid size-7 shrink-0 place-items-center rounded-full text-[12.5px] font-semibold ${
                  i < stage ? "bg-pass text-paper" : i === stage ? "bg-crimson text-paper" : "bg-sand text-muted"
                }`}
              >
                {i < stage ? <Check size={14} strokeWidth={3} /> : i + 1}
              </span>
              <span className={`text-[14px] font-medium ${i === stage ? "text-ink" : "text-muted"}`}>{s.label}</span>
              {i < STAGES.length - 1 && <span className={`h-[2px] flex-1 ${i < stage ? "bg-pass/40" : "bg-line"}`} />}
            </li>
          ))}
        </ol>

        <section className="mt-6 rounded-lg bg-paper p-6 ring-1 ring-line">
          {phase === "lobby" && (
            <>
              <h2 className="display text-[24px]">Waiting for players</h2>
              <p className="mt-1 text-[14.5px] text-ink-2">
                {teams.length} {teams.length === 1 ? "person has" : "people have"} joined. When everyone&apos;s in, start the demo and build it
                together on the big screen.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">{btn("demo", "Start the demo", { variant: "primary" })}</div>
            </>
          )}
          {phase === "demo" && (
            <>
              <h2 className="display text-[24px]">Demo in progress</h2>
              <p className="mt-1 text-[14.5px] text-ink-2">
                Build it on the big screen while everyone follows along. Finished players wait here until you start the clock.
              </p>
              <div className="mt-4 flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-sand">
                  <div className="h-full bg-pass transition-all" style={{ width: `${teams.length ? (demoDone.size / teams.length) * 100 : 0}%` }} />
                </div>
                <span className="text-[14px] font-semibold tabular-nums">
                  {demoDone.size} of {teams.length} done
                </span>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <a
                  href="/demo"
                  target="_blank"
                  className="flex items-center gap-2 rounded-full px-5 py-2.5 text-[15px] font-medium ring-1 ring-ink hover:bg-cream"
                >
                  <MonitorPlay size={16} /> Open the demo to present
                </a>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-5">
                <Stepper value={minutes} onChange={setMinutes} min={5} max={90} step={5} suffix="min" />
                {btn("start", "Start the clock", { variant: "primary", mins: minutes })}
              </div>
            </>
          )}
          {(phase === "running" || phase === "paused") && (
            <>
              <div className="flex items-baseline justify-between">
                <h2 className="display text-[24px]">{phase === "paused" ? "Paused" : "Levels in progress"}</h2>
                <span className="text-[28px] font-semibold tabular-nums">{clock}</span>
              </div>
              <p className="mt-1 text-[14.5px] text-ink-2">
                {phase === "paused" ? "The clock is stopped and player screens are covered." : "Everyone is working through the 8 levels."}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                {phase === "running" ? btn("pause", "Pause") : btn("resume", "Resume", { variant: "primary" })}
                {btn("add_time", "+5 minutes", { mins: 5 })}
                {btn("end", "End the session", { variant: phase === "running" ? "primary" : "secondary" })}
              </div>
            </>
          )}
          {phase === "ended" && (
            <>
              <h2 className="display text-[24px]">Session over</h2>
              <p className="mt-1 text-[14.5px] text-ink-2">Final standings are on the big screen.</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button onClick={onLeave}>Start a new room</Button>
              </div>
            </>
          )}
          {error && <p className="mt-4 rounded bg-fail-soft px-3 py-2 text-[13.5px] text-fail">{error}</p>}
        </section>

        <section className="mt-4 rounded-lg bg-paper p-6 ring-1 ring-line">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold">
            <Users size={16} /> Players <span className="font-normal text-muted">· {teams.length}</span>
          </h2>
          <ol className="mt-3 divide-y divide-line text-[14.5px]">
            {rows.map((r, i) => (
              <li key={r.team.id} className="flex items-center gap-3 py-2.5">
                <span className="w-6 text-muted">{i + 1}</span>
                <span className="flex-1 truncate font-medium">{r.team.name}</span>
                {phase === "demo" ? (
                  demoDone.has(r.team.id) ? (
                    <span className="flex items-center gap-1 text-pass">
                      <Check size={14} strokeWidth={3} /> demo done
                    </span>
                  ) : (
                    <span className="text-muted">working on it</span>
                  )
                ) : (
                  <span className="text-muted">
                    {r.cleared.length}/{LEVELS.length} cleared
                  </span>
                )}
                <span className="w-16 text-right font-semibold tabular-nums">{r.points}</span>
              </li>
            ))}
            {rows.length === 0 && <li className="py-2 text-muted">Nobody yet. Share the code above.</li>}
          </ol>
        </section>

        <section className="mt-8 flex flex-wrap gap-3 border-t border-line pt-6">
          {phase !== "lobby" && phase !== "ended" && btn("lobby", "Back to lobby")}
          {btn("reset", "Reset this room", { variant: "danger" })}
          {phase !== "ended" && (
            <Button variant="ghost" onClick={onLeave}>
              Start a new room
            </Button>
          )}
        </section>
      </main>
    </Shell>
  );
}

function Shell({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper">
      <header className="flex h-16 items-center border-b border-line px-8">
        <Logo />
        <span className="ml-3 rounded-full bg-sand px-2.5 py-0.5 text-[12px] font-medium text-ink-2">Host</span>
        <div className="ml-auto">{right}</div>
      </header>
      {children}
    </div>
  );
}
