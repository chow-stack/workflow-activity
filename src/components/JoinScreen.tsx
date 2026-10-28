"use client";

import { ArrowLeft, ArrowRight, LoaderCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { KEYS, load, save } from "@/lib/storage";
import type { Team } from "@/lib/store";
import { normalizeCode } from "@/lib/supabase";
import { findRoom, joinRoom, rejoinRoom } from "@/lib/teams";
import { Button, Logo } from "./ui";

/** Kahoot-style join: room code first, then your name. */
export function JoinScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState(() => normalizeCode(params.get("room") ?? ""));
  const [room, setRoom] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taken, setTaken] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = load<Team | null>(KEYS.team, null);
    if (saved?.room) router.replace("/play");
  }, [router]);

  useEffect(() => {
    if (room) nameInput.current?.focus();
  }, [room]);

  const checkCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await findRoom(code);
    setBusy(false);
    if (res.error || !res.room) return setError(res.error ?? "Something went wrong.");
    setRoom(res.room.code);
  };

  const finish = (team: Team) => {
    save(KEYS.team, team);
    router.push("/play");
  };

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!room) return;
    setBusy(true);
    setError(null);
    setTaken(false);
    const res = await joinRoom(room, name);
    setBusy(false);
    if (res.team) return finish(res.team);
    setError(res.error ?? "Something went wrong.");
    setTaken(Boolean(res.taken));
  };

  const continueAsMe = async () => {
    if (!room) return;
    setBusy(true);
    const res = await rejoinRoom(room, name);
    setBusy(false);
    if (res.team) return finish(res.team);
    setError(res.error ?? "Something went wrong.");
  };

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <header className="flex h-16 items-center px-8">
        <Logo />
      </header>

      <main className="grid flex-1 place-items-center px-6 pb-24">
        <div className="w-full max-w-[400px] text-center">
          {!room ? (
            <form onSubmit={checkCode} className="animate-rise">
              <h1 className="display text-[40px] leading-tight">Join the room</h1>
              <p className="mt-2 text-[15px] text-muted">Enter the code on the big screen.</p>
              <input
                autoFocus
                value={code}
                onChange={(e) => {
                  setCode(normalizeCode(e.target.value));
                  setError(null);
                }}
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                placeholder="CODE"
                aria-label="Room code"
                className="mt-8 w-full rounded-lg border-2 border-line-strong bg-paper py-4 text-center font-mono text-[36px] font-semibold tracking-[0.35em] text-ink uppercase outline-none placeholder:tracking-[0.2em] placeholder:text-faint focus:border-ink"
              />
              <Button size="lg" disabled={busy || code.length !== 5} className="mt-4 w-full">
                {busy ? <LoaderCircle size={18} className="animate-spin" /> : null}
                Enter <ArrowRight size={17} />
              </Button>
            </form>
          ) : (
            <form onSubmit={join} className="animate-rise">
              <button
                type="button"
                onClick={() => {
                  setRoom(null);
                  setError(null);
                  setTaken(false);
                }}
                className="mx-auto mb-6 flex items-center gap-1.5 rounded-full bg-cream px-3 py-1 text-[13px] text-ink-2 ring-1 ring-line hover:ring-ink-2"
              >
                <ArrowLeft size={13} /> Room <span className="font-mono font-semibold tracking-wider">{room}</span>
              </button>
              <h1 className="display text-[40px] leading-tight">What&apos;s your name?</h1>
              <p className="mt-2 text-[15px] text-muted">This is how you&apos;ll show up on the leaderboard.</p>
              <input
                ref={nameInput}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                  setTaken(false);
                }}
                maxLength={40}
                placeholder="e.g. Maya P."
                aria-label="Your name"
                className="mt-8 w-full rounded-lg border-2 border-line-strong bg-paper px-4 py-4 text-center text-[22px] font-medium text-ink outline-none placeholder:text-faint focus:border-ink"
              />
              <Button size="lg" disabled={busy || !name.trim()} className="mt-4 w-full">
                {busy ? <LoaderCircle size={18} className="animate-spin" /> : null}
                Join <ArrowRight size={17} />
              </Button>
            </form>
          )}

          {error && (
            <div className="animate-pop mt-4 text-[14px] text-fail">
              {error}
              {taken && (
                <div className="mt-2 flex justify-center gap-2 text-ink-2">
                  <span>Add your last initial, or</span>
                  <button onClick={continueAsMe} className="font-semibold text-crimson underline-offset-2 hover:underline">
                    continue as “{name.trim()}”
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
