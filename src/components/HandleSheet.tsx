import { useState } from "react";
import { Sheet } from "./layout/Sheet";

export function HandleSheet({
  initialHandle,
  onShuffle,
  onConfirm,
}: {
  initialHandle: string;
  onShuffle: () => Promise<string>;
  onConfirm: (handle: string) => Promise<void>;
}) {
  const [handle, setHandle] = useState(initialHandle);
  const [customMode, setCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function shuffle() {
    setBusy(true);
    setError(null);
    try {
      const next = await onShuffle();
      setHandle(next);
    } finally {
      setBusy(false);
    }
  }

  async function confirm(value: string) {
    setBusy(true);
    setError(null);
    try {
      await onConfirm(value);
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
        <div
          className="box"
          style={{
            borderColor: "var(--chart-4)",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span className="num" style={{ fontSize: 16 }}>
            {handle}
          </span>
          <span
            style={{ fontSize: 11, color: "var(--chart-4)", cursor: "pointer" }}
            onClick={shuffle}
          >
            shuffle ⟳
          </span>
        </div>
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
          {handle}
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
        onClick={() => confirm(customMode ? customValue.trim() : handle)}
      >
        Post as {customMode ? customValue.trim() || "…" : handle}
      </button>
      <button className="ghost" disabled={busy} onClick={() => confirm(handle)}>
        Post anonymously this once
      </button>
    </Sheet>
  );
}
