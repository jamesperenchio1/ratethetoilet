import { useState } from "react";
import { Sheet } from "./layout/Sheet";
import { generateHandleBatch } from "../lib/handleGenerator";
import { CONFIG } from "../lib/config";

function SaveNameInline({
  onSend,
  onSkip,
}: {
  onSend: (email: string) => Promise<void>;
  onSkip: () => void;
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  if (state === "sent") {
    return <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Check your email to finish saving it.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="box"
          style={{ flex: 1, padding: "8px 9px", fontSize: 12 }}
        />
        <button
          className="btn2"
          style={{ width: "auto", padding: "8px 12px", fontSize: 12 }}
          disabled={!email.trim() || state === "sending"}
          onClick={async () => {
            setState("sending");
            try {
              await onSend(email.trim());
              setState("sent");
            } catch {
              setState("error");
            }
          }}
        >
          Send
        </button>
      </div>
      {state === "error" && (
        <div style={{ fontSize: 11, color: "var(--text-danger)" }}>Couldn't send that — try again.</div>
      )}
      <span style={{ fontSize: 11, color: "var(--text-muted)", cursor: "pointer" }} onClick={onSkip}>
        not now
      </span>
    </div>
  );
}

export function HandleSheet({
  onConfirm,
  onSaveNameRequested,
}: {
  onConfirm: (handle: string) => Promise<void>;
  onSaveNameRequested: (email: string) => Promise<void>;
}) {
  const [suggestions, setSuggestions] = useState<string[]>(() => generateHandleBatch());
  const [selected, setSelected] = useState(suggestions[0]);
  const [customMode, setCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveExpanded, setSaveExpanded] = useState(false);

  function shuffle() {
    const next = generateHandleBatch();
    setSuggestions(next);
    setSelected(next[0]);
  }

  async function confirm(value: string) {
    const v = value.trim();
    if (!/^[a-zA-Z0-9_]+$/.test(v) || v.length < 3 || v.length > CONFIG.handle.maxLength) {
      setError(`Names are 3–${CONFIG.handle.maxLength} letters, numbers, or underscores.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onConfirm(v);
    } catch {
      setError("That name is taken — try another.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet>
      <b style={{ fontSize: 15 }}>You'll show up as</b>

      {!customMode ? (
        <>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {suggestions.map((s) => (
              <span
                key={s}
                className={`chip ${s === selected ? "on" : ""}`}
                onClick={() => setSelected(s)}
              >
                {s}
              </span>
            ))}
          </div>
          <span
            style={{ fontSize: 11, color: "var(--chart-4)", cursor: "pointer", alignSelf: "flex-start" }}
            onClick={shuffle}
          >
            shuffle ⟳
          </span>
        </>
      ) : (
        <input
          autoFocus
          value={customValue}
          onChange={(e) => setCustomValue(e.target.value.replace(/\s+/g, "_"))}
          placeholder="pick a name"
          className="box"
          style={{ font: "600 15px var(--font-mono)" }}
        />
      )}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <span
          className={`chip ${!customMode ? "on" : ""}`}
          onClick={() => setCustomMode(false)}
        >
          suggestions
        </span>
        <span
          className={`chip ${customMode ? "on" : ""}`}
          onClick={() => setCustomMode(true)}
        >
          pick my own
        </span>
      </div>

      <div style={{ fontSize: 12, lineHeight: 1.4, color: "var(--text-secondary)" }}>
        Names keep your notes together so people can tell who has been where. No email
        needed.
      </div>

      {error && <div style={{ fontSize: 12, color: "var(--text-danger)" }}>{error}</div>}

      <button
        className="btn"
        disabled={busy || (customMode && !customValue.trim())}
        onClick={() => confirm(customMode ? customValue.trim() : selected)}
      >
        Post as {customMode ? customValue.trim() || "…" : selected}
      </button>

      {!saveExpanded ? (
        <div
          style={{ fontSize: 11, color: "var(--text-muted)", cursor: "pointer" }}
          onClick={() => setSaveExpanded(true)}
        >
          Want to keep this name across devices? <span style={{ color: "var(--chart-4)" }}>Save it</span>
        </div>
      ) : (
        <SaveNameInline onSend={onSaveNameRequested} onSkip={() => setSaveExpanded(false)} />
      )}
    </Sheet>
  );
}
