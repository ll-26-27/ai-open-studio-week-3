"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Re-renders the server page on a timer so new files in _media/ show up during class without a reload.
export default function AutoRefresh({ seconds = 10 }) {
  const router = useRouter();
  const [on, setOn] = useState(true);
  // Set only in the browser: a time stamped during server rendering never matches the one made while hydrating.
  const [tick, setTick] = useState(null);

  useEffect(() => { setTick(new Date()); }, []);

  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => { router.refresh(); setTick(new Date()); }, seconds * 1000);
    return () => clearInterval(id);
  }, [on, seconds, router]);

  return (
    <div className="live-controls">
      <button type="button" className="live-toggle" onClick={() => setOn((value) => !value)} aria-pressed={on}>
        <span className={on ? "live-dot live-dot-on" : "live-dot"} aria-hidden="true" />
        {on ? `Live · every ${seconds}s` : "Paused"}
      </button>
      <span className="live-stamp">{tick ? `checked ${tick.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}</span>
    </div>
  );
}
