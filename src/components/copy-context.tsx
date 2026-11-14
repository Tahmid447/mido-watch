"use client";
import { useState } from "react";
export function CopyContext() {
  const [message, setMessage] = useState(""),
    [pending, setPending] = useState(false);
  return (
    <div>
      <button
        type="button"
        className="button primary"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          try {
            const r = await fetch("/api/export/chatgpt", { cache: "no-store" });
            if (!r.ok)
              throw new Error("Sign in again before copying your context.");
            const context = await r.json();
            await navigator.clipboard.writeText(JSON.stringify(context));
            setMessage(
              "Context copied. Paste it into your ChatGPT conversation.",
            );
          } catch {
            setMessage(
              "Copy is unavailable here. Use Download context instead.",
            );
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? "Preparing…" : "Copy Context"}
      </button>
      {message && (
        <p role="status" className="small">
          {message}
        </p>
      )}
    </div>
  );
}
