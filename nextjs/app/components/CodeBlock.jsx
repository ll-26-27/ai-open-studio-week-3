"use client";

import { useRef, useState } from "react";

// Wraps every fenced code block from the Markdown with a copy button.
// The text copied is exactly what is inside the <pre>, so one-command-per-block stays paste-ready.
export default function CodeBlock({ children }) {
  const preRef = useRef(null);
  const [state, setState] = useState("idle");

  async function copy() {
    const text = (preRef.current?.innerText ?? "").replace(/\n$/, "");
    let ok = false;
    if (navigator.clipboard?.writeText) {
      try { await navigator.clipboard.writeText(text); ok = true; } catch { ok = false; }
    }
    if (!ok) {
      // Fallback for non-secure origins (a LAN address, http) where the clipboard API is unavailable.
      const range = document.createRange();
      range.selectNodeContents(preRef.current);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      try { ok = document.execCommand("copy"); } catch { ok = false; }
      selection.removeAllRanges();
    }
    setState(ok ? "copied" : "failed");
    setTimeout(() => setState("idle"), 1600);
  }

  const label = state === "copied" ? "Copied" : state === "failed" ? "Select and copy" : "Copy";

  return (
    <div className="code-block">
      <button type="button" className="code-copy" onClick={copy} aria-live="polite" data-state={state}>{label}</button>
      <pre ref={preRef}>{children}</pre>
    </div>
  );
}
