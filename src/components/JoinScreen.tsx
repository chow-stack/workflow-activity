"use client";

import { ArrowRight, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { KEYS, load, save } from "@/lib/storage";
import type { Team } from "@/lib/store";
import { createTeam, findTeam } from "@/lib/teams";
import { Logo } from "./TopBar";
import { inputCls } from "./panels/fields";

export function JoinScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "rejoin">("create");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (load<Team | null>(KEYS.team, null)) router.replace("/play");
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = mode === "create" ? await createTeam(name) : await findTeam(name);
    setBusy(false);
    if (res.error || !res.team) return setError(res.error ?? "Something went wrong.");
    save(KEYS.team, res.team);
    router.push("/play");
  };

  return (
    <div className="relative grid min-h-screen overflow-hidden lg:grid-cols-[1.05fr_1fr]">
      <div className="flex flex-col px-10 py-10 lg:px-16">
        <Logo size={34} />
        <div className="my-auto max-w-[520px] py-16">
          <div className="mb-5 inline-flex rounded-full border border-line bg-surface px-3 py-1 text-[11.5px] font-medium tracking-wider text-ink-muted uppercase">
            Automation meeting
          </div>
          <h1 className="font-display text-[56px] leading-[1.02] font-medium">
            Build it. Run it.
            <br />
            <span className="text-crimson">Climb the board.</span>
          </h1>
          <p className="mt-5 max-w-[440px] text-[16px] leading-relaxed text-ink-muted">
            Eight real scenarios. Your team builds the workflow, runs it against hidden tests, and moves on when it works. One captain
            drives; everyone else thinks out loud.
          </p>

          <form onSubmit={submit} className="mt-9 max-w-[420px]">
            <label className="mb-2 block text-[13px] font-medium">{mode === "create" ? "Team name" : "Your team's exact name"}</label>
            <div className="flex gap-2">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                placeholder="e.g. The Zap Pack"
                className={`${inputCls} py-3 text-[15px]`}
              />
              <button
                disabled={busy || !name.trim()}
                className="flex shrink-0 items-center gap-2 rounded-lg bg-crimson px-5 text-[15px] font-medium text-white hover:bg-crimson-dark disabled:opacity-50"
              >
                {busy ? <LoaderCircle size={17} className="animate-spin" /> : <ArrowRight size={17} />}
                {mode === "create" ? "Create" : "Rejoin"}
              </button>
            </div>
            {error && <p className="mt-2 text-[13px] text-fail">{error}</p>}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "create" ? "rejoin" : "create");
                setError(null);
              }}
              className="mt-4 text-[13px] text-ink-muted underline-offset-2 hover:text-ink hover:underline"
            >
              {mode === "create" ? "Already made a team? Rejoin it" : "Need a new team? Create one"}
            </button>
          </form>
        </div>
        <p className="text-[12px] text-ink-muted">Gen AI Club · Indiana University</p>
      </div>

      <div
        className="relative hidden bg-canvas lg:block"
        style={{
          backgroundImage:
            "radial-gradient(circle at 80% 0%, rgb(152 27 37 / 0.3), transparent 60%), radial-gradient(circle, #4a3537 1.4px, transparent 1.6px)",
          backgroundSize: "100% 100%, 22px 22px",
        }}
      >
        <HeroFlow />
      </div>
    </div>
  );
}

/** Decorative workflow on the dark canvas. Static SVG, no interaction. */
function HeroFlow() {
  const node = (x: number, y: number, label: string, sub: string, color: string, trigger = false) => (
    <g transform={`translate(${x} ${y})`}>
      <rect width="200" height="58" rx={trigger ? 29 : 12} fill="#261b1c" stroke="#3d2c2d" />
      {!trigger && <rect width="3" height="58" rx="1.5" fill={color} />}
      <rect x="14" y="13" width="32" height="32" rx={trigger ? 16 : 8} fill={color} opacity="0.18" />
      <circle cx="30" cy="29" r="5" fill={color} />
      <text x="58" y="27" fill="#ede6e3" fontSize="13" fontFamily="var(--font-dm-sans)">
        {label}
      </text>
      <text x="58" y="44" fill="#a8999a" fontSize="11" fontFamily="var(--font-dm-sans)">
        {sub}
      </text>
    </g>
  );
  const edge = (d: string, lit = false) => (
    <path d={d} fill="none" stroke={lit ? "#f07a3d" : "#5a4446"} strokeWidth={lit ? 2.5 : 2} className={lit ? "edge-flowing" : ""} />
  );
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="-20 150 780 360" preserveAspectRatio="xMidYMid meet">
      {edge("M 220 329 C 250 329 240 329 270 329", true)}
      {edge("M 470 329 C 510 329 480 249 520 249", true)}
      {edge("M 470 329 C 510 329 480 409 520 409")}
      {node(20, 300, "New email", "On each new email", "#d9434f", true)}
      {node(270, 300, "AI Classify", "→ recruiting, other", "#c77dba")}
      {node(520, 220, "Slack message", "Post in #recruiting", "#6faf8a")}
      {node(520, 380, "Add sheet row", "Add to Inbox log", "#6faf8a")}
      <g transform="translate(214 290)">
        <rect width="62" height="20" rx="10" fill="#3a1f1c" stroke="#f07a3d" strokeOpacity="0.5" />
        <text x="31" y="14" textAnchor="middle" fill="#ffd2b8" fontSize="10.5" fontFamily="var(--font-jetbrains)">
          6 items
        </text>
      </g>
      <g transform="translate(468 262)">
        <rect width="56" height="20" rx="10" fill="#3a1f1c" stroke="#f07a3d" strokeOpacity="0.5" />
        <text x="28" y="14" textAnchor="middle" fill="#ffd2b8" fontSize="10.5" fontFamily="var(--font-jetbrains)">
          2 items
        </text>
      </g>
    </svg>
  );
}
