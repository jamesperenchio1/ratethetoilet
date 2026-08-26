import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TopBar } from "../components/layout/TopBar";
import { useIdentity } from "../components/IdentityGateProvider";
import { supabase } from "../lib/supabase";

/** Landing page for the "forgot password" email link. Supabase's client
 * detects the recovery token in the URL and fires a PASSWORD_RECOVERY auth
 * event with a live session for that user — we just need to collect the new
 * password and call setPassword() while that session is active. */
export function ResetPassword() {
  const navigate = useNavigate();
  const { setPassword } = useIdentity();
  const [ready, setReady] = useState(false);
  const [password, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    // Covers the case where the event already fired before this mounted.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit() {
    if (password.length < 6) {
      setError("Password needs to be at least 6 characters.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await setPassword(password);
      setDone(true);
      setTimeout(() => navigate("/you"), 1200);
    } catch {
      setError("Couldn't set that password — try the link again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <TopBar title="Set a new password" />
      <div className="screen-body">
        {!ready ? (
          <div className="ann">Verifying your link…</div>
        ) : done ? (
          <div className="note">Password set — taking you to your posts…</div>
        ) : (
          <>
            <div className="lbl">New password</div>
            <input
              autoFocus
              className="box"
              style={{ minHeight: 40 }}
              value={password}
              onChange={(e) => setNewPassword(e.target.value)}
              type="password"
              autoComplete="new-password"
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            {error && <div style={{ fontSize: 12, color: "var(--text-danger)" }}>{error}</div>}
            <button className="btn" disabled={!password || busy} onClick={submit}>
              Set password
            </button>
          </>
        )}
      </div>
    </>
  );
}
