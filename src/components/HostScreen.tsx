"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatClock, secondsLeft, useLeaderboardData, useNow, useSession } from "@/lib/live";
import { standings } from "@/lib/scoring";
import { KEYS, load, remove, save } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import { Logo } from "./TopBar";
import { inputCls } from "./panels/fields";

type Action = "start" | "pause" | "resume" | "add_time" | "boss" | "end" | "lobby" | "reset";

export function HostScreen() {
  const [pass, setPass] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Action | "login" | null>(null);
  const [minutes, setMinutes] = useState(30);
  const [bossMinutes, setBossMinutes] = useState(10);
  const { session } = useSession();
  const { teams, completions, boss } = useLeaderboardData();
  const now = useNow();
  const rows = useMemo(() => standings(teams, completions), [teams, completions]);

  useEffect(() => {
    const stored = load<string | null>(KEYS.host, null);
    // Read after mount: localStorage isn't available during server prerender.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setPass(stored);
  }, []);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("login");
    const { data, error: err } = await supabase().rpc("host_check", { p_passcode: draft });
    setBusy(null);
    if (err || !data) return setError("Wrong passcode.");
    save(KEYS.host, draft);
    setPass(draft);
    setError(null);
  };

  const act = async (action: Action, mins?: number) => {
    if (action === "reset" && !window.confirm("Delete every team, score and boss design and go back to the lobby?")) return;
    if (action === "end" && !window.confirm("End the activity for everyone?")) return;
    setBusy(action);
    const { error: err } = await supabase().rpc("host_action", { p_passcode: pass, p_action: action, p_minutes: mins ?? null });
    setBusy(null);
    if (err) {
      setError(err.message);
      if (/passcode/i.test(err.message)) {
        remove(KEYS.host);
        setPass(null);
      }
    } else setError(null);
  };

  if (!pass) {
    return (
      <div className="grid min-h-screen place-items-center p-8">
        <form onSubmit={login} className="w-full max-w-sm">
          <Logo size={34} />
          <h1 className="mt-8 font-display text-3xl">Host controls</h1>
          <input
            type="password"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Passcode"
            className={`${inputCls} mt-5 py-3`}
          />
          {error && <p className="mt-2 text-[13px] text-fail">{error}</p>}
          <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-crimson py-3 font-medium text-white">
            {busy === "login" && <LoaderCircle size={16} className="animate-spin" />} Unlock
          </button>
        </form>
      </div>
    );
  }

  const phase = session?.phase ?? "lobby";
  const btn = (action: Action, label: string, opts: { primary?: boolean; danger?: boolean; mins?: number; disabled?: boolean } = {}) => (
    <button
      onClick={() => act(action, opts.mins)}
      disabled={busy !== null || opts.disabled}
      className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[14px] font-medium transition disabled:opacity-40 ${
        opts.primary
          ? "bg-crimson text-white hover:bg-crimson-dark"
          : opts.danger
            ? "text-fail ring-1 ring-fail/30 hover:bg-fail/5"
            : "bg-surface ring-1 ring-line hover:ring-ink/30"
      }`}
    >
      {busy === action && <LoaderCircle size={15} className="animate-spin" />}
      {label}
    </button>
  );

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <div className="flex items-center">
        <Logo size={34} />
        <button
          onClick={() => {
            remove(KEYS.host);
            setPass(null);
          }}
          className="ml-auto text-[13px] text-ink-muted hover:text-ink"
        >
          Lock
        </button>
      </div>

      <div className="mt-8 flex items-baseline gap-4">
        <h1 className="font-display text-4xl capitalize">{phase}</h1>
        <span className="font-mono text-2xl tabular-nums text-ink-muted">{formatClock(secondsLeft(session, now))}</span>
        <span className="ml-auto text-[14px] text-ink-muted">
          {teams.length} {teams.length === 1 ? "team" : "teams"} · {boss.length} boss {boss.length === 1 ? "design" : "designs"}
        </span>
      </div>
      {error && <p className="mt-3 rounded-lg bg-fail/10 px-3 py-2 text-[13px] text-fail">{error}</p>}

      <section className="mt-8 rounded-2xl bg-surface p-6 ring-1 ring-line">
        <h2 className="mb-4 text-[13px] font-medium tracking-wider text-ink-muted uppercase">Levels round</h2>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-[14px]">
            <input type="number" min={1} max={120} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className={`${inputCls} w-20`} />
            minutes
          </label>
          {btn("start", phase === "running" ? "Restart clock" : "Start levels", { primary: phase === "lobby", mins: minutes })}
          {phase === "running" && btn("pause", "Pause")}
          {phase === "paused" && btn("resume", "Resume", { primary: true })}
          {(phase === "running" || phase === "boss") && btn("add_time", "+5 min", { mins: 5 })}
        </div>
      </section>

      <section className="mt-4 rounded-2xl bg-surface p-6 ring-1 ring-line">
        <h2 className="mb-4 text-[13px] font-medium tracking-wider text-ink-muted uppercase">Boss round + wrap-up</h2>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-[14px]">
            <input type="number" min={1} max={60} value={bossMinutes} onChange={(e) => setBossMinutes(Number(e.target.value))} className={`${inputCls} w-20`} />
            minutes
          </label>
          {btn("boss", "Start boss round", { primary: phase === "running" || phase === "paused", mins: bossMinutes })}
          {btn("end", "End activity")}
        </div>
      </section>

      <section className="mt-4 rounded-2xl bg-surface p-6 ring-1 ring-line">
        <h2 className="mb-4 text-[13px] font-medium tracking-wider text-ink-muted uppercase">Standings</h2>
        <ol className="divide-y divide-line text-[14px]">
          {rows.map((r, i) => (
            <li key={r.team.id} className="flex items-center gap-3 py-2">
              <span className="w-6 text-ink-muted">{i + 1}</span>
              <span className="flex-1 truncate font-medium">{r.team.name}</span>
              <span className="text-ink-muted">{r.cleared.length}/8 cleared</span>
              <span className="w-20 text-right font-mono tabular-nums">{r.points}</span>
            </li>
          ))}
          {rows.length === 0 && <li className="py-2 text-ink-muted">No teams yet.</li>}
        </ol>
      </section>

      <section className="mt-4 flex flex-wrap gap-3">
        {btn("lobby", "Back to lobby")}
        {btn("reset", "Reset everything", { danger: true })}
        <a href="/board" target="_blank" className="ml-auto self-center text-[14px] text-crimson hover:underline">
          Open projector board ↗
        </a>
      </section>
    </div>
  );
}
