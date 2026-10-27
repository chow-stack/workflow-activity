"use client";

import { ArrowRight, Check, FileText, Hash, LoaderCircle, Tags } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { KEYS, load, save } from "@/lib/storage";
import type { Team } from "@/lib/store";
import { createTeam, findTeam } from "@/lib/teams";
import { inputCls } from "./panels/fields";
import { Button, Eyebrow, Logo } from "./ui";

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
    <div className="min-h-screen bg-paper">
      <header className="flex h-16 items-center border-b border-line px-8">
        <Logo />
      </header>

      <main className="mx-auto grid max-w-[1200px] items-center gap-16 px-8 py-16 lg:grid-cols-[1.05fr_1fr] lg:py-20">
        <div>
          <Eyebrow>Automation meeting</Eyebrow>
          <h1 className="display mt-4 text-[56px] leading-[1.02]">
            Build it. Run it.
            <br />
            <span className="text-crimson">Climb the board.</span>
          </h1>
          <p className="mt-5 max-w-[460px] text-[17px] leading-relaxed text-ink-2">
            Eight real scenarios. Build a workflow for each one, run it against hidden tests, and move on when it works.
          </p>

          <ul className="mt-6 space-y-2 text-[15px] text-ink-2">
            {[
              "Work at your own pace on your own laptop.",
              "Clear a level to unlock the next one.",
              "Hints help, but cost points.",
            ].map((t) => (
              <li key={t} className="flex gap-2.5">
                <Check size={18} className="mt-0.5 shrink-0 text-crimson" strokeWidth={2.5} />
                {t}
              </li>
            ))}
          </ul>

          <form onSubmit={submit} className="mt-10 max-w-[460px]">
            <label className="mb-2 block text-[14px] font-semibold">{mode === "create" ? "Your name" : "The exact name you joined with"}</label>
            <div className="flex gap-2">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                placeholder="e.g. Maya P."
                className={`${inputCls} min-h-[48px] text-[16px]`}
              />
              <Button size="lg" disabled={busy || !name.trim()} className="shrink-0">
                {busy && <LoaderCircle size={17} className="animate-spin" />}
                {mode === "create" ? "Start" : "Continue"}
                {!busy && <ArrowRight size={17} />}
              </Button>
            </div>
            {error && <p className="mt-2 text-[13.5px] text-fail">{error}</p>}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "create" ? "rejoin" : "create");
                setError(null);
              }}
              className="mt-4 text-[14px] font-medium text-ink-2 underline-offset-4 hover:underline"
            >
              {mode === "create" ? "Already joined on another device? Pick up where you left off" : "New here? Join with your name"}
            </button>
          </form>
        </div>

        <HeroCanvas />
      </main>
    </div>
  );
}

/** A small, static picture of a workflow in the editor's style. */
function HeroCanvas() {
  const step = (n: number, cat: string, color: string, Icon: typeof FileText, label: string, sub: string) => (
    <div className="w-[270px] rounded-lg bg-paper ring-1 ring-line">
      <div className="flex items-center gap-3 px-3.5 pt-3 pb-2.5">
        <span
          className="grid size-9 place-items-center rounded-lg"
          style={{ background: `color-mix(in srgb, ${color} 11%, var(--color-paper))`, color }}
        >
          <Icon size={18} />
        </span>
        <div>
          <div className="text-[11px] font-medium text-muted">
            {n} · {cat}
          </div>
          <div className="text-[14px] font-semibold">{label}</div>
        </div>
      </div>
      <div className="border-t border-line px-3.5 py-2 text-[12px] text-muted">{sub}</div>
    </div>
  );
  const link = (count: string) => (
    <div className="relative ml-[134px] h-10 w-[2px] bg-crimson">
      <span className="absolute top-1/2 left-3 -translate-y-1/2 rounded-full bg-crimson px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-paper">
        {count}
      </span>
    </div>
  );
  return (
    <div
      className="relative hidden h-[500px] items-center justify-center rounded-[32px] bg-cream ring-1 ring-line lg:flex"
      style={{ backgroundImage: "radial-gradient(circle, var(--color-dot) 1.3px, transparent 1.5px)", backgroundSize: "20px 20px" }}
    >
      <div>
        {step(1, "Trigger", "var(--color-cat-trigger)", FileText, "Form submitted", "On each review")}
        {link("6 items")}
        {step(2, "AI", "var(--color-cat-ai)", Tags, "AI Classify", "→ positive, negative, question")}
        {link("2 items")}
        {step(3, "Action", "var(--color-cat-action)", Hash, "Slack message", "Post in #customer-care")}
      </div>
      <div className="absolute right-8 bottom-8 flex items-center gap-2 rounded-full bg-pass px-4 py-2 text-[13px] font-medium text-paper">
        <Check size={15} strokeWidth={3} /> 6 of 6 tests passed
      </div>
    </div>
  );
}
