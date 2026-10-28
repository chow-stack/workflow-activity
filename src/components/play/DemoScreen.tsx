"use client";

import { RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { DEMO } from "@/levels";
import { usePlay } from "@/lib/store";
import { ScreenGuard } from "../ScreenGuard";
import { TopBar } from "../TopBar";
import { HintButton } from "./HintButton";
import { Workspace } from "./Workspace";

// A local-only player for the host's walkthrough: progress stays on this laptop and never reaches the board.
const HOST_DEMO = { id: "host-demo", name: "Host", room: "" };

/** The warm-up level for the host to present on the big screen. Nothing is recorded. */
export function DemoScreen() {
  const s = usePlay();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const st = usePlay.getState();
    st.init(HOST_DEMO);
    st.setLevel(0);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(true);
  }, []);

  if (!ready || s.progress.currentLevel !== 0) return null;

  const restart = () => {
    const st = usePlay.getState();
    st.setWorkflow({ nodes: [], edges: [] });
    st.setGrade(null);
    st.setDrawer(false);
  };

  return (
    <ScreenGuard>
      <div className="flex h-screen flex-col">
        <TopBar
          teamName="Host demo"
          progress={s.progress}
          clock={null}
          showPoints={false}
          center={<span className="rounded-full bg-crimson-soft px-4 py-1.5 text-[14px] font-semibold text-crimson">Warm-up walkthrough</span>}
          hint={<HintButton level={DEMO} used={s.progress.hints[0] ?? 0} onReveal={s.takeHint} />}
          right={
            <button onClick={restart} title="Clear the canvas" className="rounded-full p-1.5 text-muted hover:bg-sand hover:text-ink">
              <RotateCcw size={15} />
            </button>
          }
        />
        <div className="relative flex min-h-0 flex-1">
          <Workspace level={DEMO} online={false} doneNote="That's the whole idea. Now everyone try it on your own laptop." />
        </div>
      </div>
    </ScreenGuard>
  );
}
