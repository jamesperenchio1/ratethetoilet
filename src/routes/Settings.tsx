import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { TopBar } from "../components/layout/TopBar";
import { useIdentity } from "../components/IdentityGateProvider";
import { supabase } from "../lib/supabase";
import { CONFIG } from "../lib/config";

export function Settings() {
  const navigate = useNavigate();
  const { profile, isGuest, setHandle } = useIdentity();
  const [renaming, setRenaming] = useState(false);
  const [newHandle, setNewHandle] = useState(profile?.handle ?? "");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function rename() {
    setError(null);
    const v = newHandle.trim();
    if (!/^[a-zA-Z0-9_]+$/.test(v) || v.length < 3 || v.length > CONFIG.handle.maxLength) {
      setError(`Names are 3–${CONFIG.handle.maxLength} letters, numbers, or underscores.`);
      return;
    }
    try {
      await setHandle(v);
      setRenaming(false);
    } catch {
      setError("That name is taken.");
    }
  }

  async function deleteMe() {
    if (!profile) return;
    await supabase.rpc("self_delete");
    await supabase.auth.signOut();
    navigate("/");
  }

  return (
    <>
      <TopBar back title="Settings" />
      <div className="screen-body">
        <div className="lbl">Handle</div>
        {renaming ? (
          <div className="box">
            <input
              autoFocus
              className="box"
              value={newHandle}
              onChange={(e) => setNewHandle(e.target.value.replace(/\s+/g, "_"))}
            />
            {error && <div style={{ fontSize: 11, color: "var(--text-danger)" }}>{error}</div>}
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn" style={{ flex: 1 }} onClick={rename}>
                Save
              </button>
              <button className="btn2" style={{ flex: 1 }} onClick={() => setRenaming(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="box" style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <span>{profile?.handle ?? "—"}</span>
            <span
              style={{ color: "var(--chart-4)", fontSize: 11, cursor: "pointer" }}
              onClick={() => setRenaming(true)}
            >
              rename
            </span>
          </div>
        )}
        <div className="box" style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <span>Backup</span>
          <span
            style={{ fontSize: 11, color: isGuest ? "var(--text-muted)" : "var(--chart-4)", cursor: "pointer" }}
            onClick={() => isGuest && navigate("/you/save-handle")}
          >
            {isGuest ? "Not saved" : "Saved"}
          </span>
        </div>

        <div className="lbl">App</div>
        <div className="box" style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <span>Language</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>ไทย / EN</span>
        </div>
        <div className="box" style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <span>Distance</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Metres</span>
        </div>
        <div className="box" style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <span>Install RateTheToilet</span>
          <span style={{ fontSize: 11, color: "var(--chart-4)" }}>Add to home screen</span>
        </div>

        <div className="lbl">Data</div>
        {!confirmDelete ? (
          <div
            className="box"
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              borderColor: "var(--red-3)",
              color: "var(--red-3)",
              cursor: "pointer",
            }}
            onClick={() => setConfirmDelete(true)}
          >
            <span>Delete my handle and posts</span>
            <span>→</span>
          </div>
        ) : (
          <div className="box" style={{ borderColor: "var(--red-3)" }}>
            <span style={{ fontSize: 12 }}>
              This hides your handle and everything you've posted. It can't be undone from here —
              are you sure?
            </span>
            <button className="btn danger" onClick={deleteMe}>
              Yes, delete everything
            </button>
            <button className="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </>
  );
}
